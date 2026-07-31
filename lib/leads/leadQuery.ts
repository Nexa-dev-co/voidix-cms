import { StageKind } from "@/generated/prisma/enums";
import type { CurrentMember } from "@/lib/auth";
import { getActiveFieldDefinitions } from "@/lib/leads/customFields";
import {
  toCustomFieldCell,
  valueColumnForKind,
  type CustomFieldDefinitionSummary,
} from "@/lib/leads/customFieldTypes";
import { parseSourceFilter, summariseOrigin } from "@/lib/leads/leadOrigin";
import type { LeadQueryParams, LeadRow } from "@/lib/leads/leadsView";
import { parseColumnKey } from "@/lib/leads/tableColumns";
import { buildContactVisibilityFilter } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * How many spreadsheets the source dropdown offers.
 *
 * Every import ever run would turn a filter into an archive. The rest stay reachable from the
 * reports, which is where "what did we import in March" belongs anyway.
 */
const MAX_BATCH_OPTIONS = 10;

export interface LeadQueryResult {
  rows: LeadRow[];
  totalCount: number;
  pageCount: number;
  params: LeadQueryParams;
  definitions: CustomFieldDefinitionSummary[];
  stageCounts: { stageId: string; count: number }[];
  dueTodayCount: number;
  overdueCount: number;
  archivedCount: number;
}

/** Start of today in the server's timezone — the boundary "due today" and "overdue" divide on. */
function startOfToday(): Date {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday(): Date {
  const start = startOfToday();

  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Everything this person may see, narrowed by the active filters.
 *
 * Always begins from `buildContactVisibilityFilter`. Every query in this module composes onto
 * this one value rather than writing its own `where` — a filter you can forget is a filter that
 * eventually leaks one salesperson's pipeline into another's screen.
 */
async function buildScopedWhere(
  member: CurrentMember,
  params: LeadQueryParams,
): Promise<Prisma.ContactWhereInput> {
  const visibility = await buildContactVisibilityFilter(member);

  const conditions: Prisma.ContactWhereInput[] = [visibility];

  conditions.push({ isArchived: params.showArchived });

  if (params.owner === "mine") {
    conditions.push({ assignedToId: member.id });
  } else if (params.owner === "unassigned") {
    conditions.push({ assignedToId: null });
  }

  if (params.stage === "open") {
    conditions.push({ stage: { kind: StageKind.OPEN } });
  } else if (params.stage !== "all") {
    conditions.push({ stageId: params.stage });
  }

  // Filters on where the lead *came from*, which is what the Source column shows — not on every
  // contact a spreadsheet happened to touch. A file that matched someone already here logged an
  // enquiry against them without changing their origin, and showing those under "q3.xlsx" would
  // contradict the column beside them.
  const sourceFilter = parseSourceFilter(params.source);

  if (sourceFilter.kind === "channel") {
    conditions.push({ originSource: sourceFilter.channel });
  } else if (sourceFilter.kind === "batch") {
    conditions.push({ originBatchId: sourceFilter.batchId });
  }

  if (params.due === "today") {
    conditions.push({ nextFollowUpAt: { gte: startOfToday(), lt: endOfToday() } });
  } else if (params.due === "overdue") {
    conditions.push({ nextFollowUpAt: { lt: startOfToday() } });
  }

  if (params.search.length > 0) {
    conditions.push({
      OR: [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { company: { contains: params.search, mode: "insensitive" } },
      ],
    });
  }

  return { AND: conditions };
}

/** The `orderBy` for a builtin column, or null when the sort targets a custom field. */
function builtinOrderBy(
  sort: string,
  direction: "asc" | "desc",
): Prisma.ContactOrderByWithRelationInput | null {
  switch (sort) {
    case "name":
      return { name: direction };
    case "email":
      return { email: direction };
    case "company":
      return { company: { sort: direction, nulls: "last" } };
    case "phone":
      return { phone: { sort: direction, nulls: "last" } };
    case "stage":
      return { stage: { sortOrder: direction } };
    case "source":
      return { originSource: direction };
    // Orders by the snapshot, not the related row, so leads added by someone since removed from
    // the team still sort under their name instead of collapsing into the nulls.
    case "addedBy":
      return { originMemberName: { sort: direction, nulls: "last" } };
    case "owner":
      return { assignedTo: { name: direction } };
    case "nextFollowUpAt":
      return { nextFollowUpAt: { sort: direction, nulls: "last" } };
    case "createdAt":
      return { createdAt: direction };
    default:
      return null;
  }
}

const ROW_INCLUDE = {
  stage: { select: { label: true, kind: true } },
  assignedTo: { select: { name: true } },
  originBatch: { select: { filename: true } },
  _count: { select: { enquiries: true } },
  attempts: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { createdAt: true, channel: true, outcome: true },
  },
  customFieldValues: true,
} satisfies Prisma.ContactInclude;

type ContactWithRelations = Prisma.ContactGetPayload<{ include: typeof ROW_INCLUDE }>;

function toLeadRow(
  contact: ContactWithRelations,
  definitions: CustomFieldDefinitionSummary[],
  today: Date,
): LeadRow {
  const storedByDefinition = new Map(
    contact.customFieldValues.map((value) => [value.definitionId, value]),
  );
  const lastAttempt = contact.attempts[0] ?? null;
  const origin = summariseOrigin(contact);

  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    company: contact.company,
    phone: contact.phone,
    stageLabel: contact.stage.label,
    stageKind: contact.stage.kind,
    sourceChannel: origin.channel,
    sourceLabel: origin.label,
    sourceDetail: origin.detail,
    addedByName: origin.addedBy,
    ownerName: contact.assignedTo?.name ?? null,
    nextFollowUpAt: contact.nextFollowUpAt?.toISOString() ?? null,
    // A closed lead is never overdue — chasing someone who already said no is exactly the
    // busywork a pipeline is supposed to prevent.
    isOverdue:
      contact.stage.kind === StageKind.OPEN &&
      contact.nextFollowUpAt !== null &&
      contact.nextFollowUpAt < today,
    lastAttemptAt: lastAttempt?.createdAt.toISOString() ?? null,
    lastAttemptSummary: lastAttempt ? `${lastAttempt.channel} · ${lastAttempt.outcome}` : null,
    touchpointCount: contact._count.enquiries,
    createdAt: contact.createdAt.toISOString(),
    isArchived: contact.isArchived,
    customCells: definitions.map((definition) =>
      toCustomFieldCell(definition, storedByDefinition.get(definition.id)),
    ),
  };
}

/**
 * One page of the leads table.
 *
 * Paging, sorting and filtering all happen in the database. The alternative — shipping every
 * lead to the browser and letting TanStack sort them — puts the whole pipeline's names, emails
 * and phone numbers into the page payload and falls over well before the 5,000-row import cap.
 */
export async function queryLeads(
  member: CurrentMember,
  params: LeadQueryParams,
): Promise<LeadQueryResult> {
  const definitions = await getActiveFieldDefinitions();
  const where = await buildScopedWhere(member, params);
  const today = startOfToday();

  const skip = (params.page - 1) * params.pageSize;
  const orderBy = builtinOrderBy(params.sort, params.direction);

  const [contacts, totalCount] = orderBy
    ? await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy: [orderBy, { id: "asc" }],
          skip,
          take: params.pageSize,
          include: ROW_INCLUDE,
        }),
        prisma.contact.count({ where }),
      ])
    : await queryOrderedByCustomField(where, params, definitions);

  return {
    rows: contacts.map((contact) => toLeadRow(contact, definitions, today)),
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / params.pageSize)),
    params,
    definitions,
    ...(await countFacets(member, params)),
  };
}

/**
 * A page ordered by a custom field's value.
 *
 * Prisma cannot `orderBy` a child row's value, but it can query *from* the child — so the sort
 * runs on `contact_field_values` with the contact filter nested inside it. That keeps
 * `buildContactVisibilityFilter` as the one gate on which contacts are reachable, which a raw
 * SQL ORDER BY would have quietly stepped around.
 *
 * Contacts with no value row for the field can't appear in that result at all, so they are
 * fetched separately and always placed last — in both directions, because "empty at the bottom"
 * is what someone sorting a column means, whichever way the arrow points.
 */
async function queryOrderedByCustomField(
  where: Prisma.ContactWhereInput,
  params: LeadQueryParams,
  definitions: CustomFieldDefinitionSummary[],
): Promise<[ContactWithRelations[], number]> {
  const parsed = parseColumnKey(params.sort);
  const definition =
    parsed?.kind === "custom"
      ? definitions.find((candidate) => candidate.id === parsed.definitionId)
      : undefined;

  // An unknown sort key (a stale bookmark, a retired field) falls back to newest first rather
  // than returning nothing.
  if (!definition) {
    const [contacts, totalCount] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        include: ROW_INCLUDE,
      }),
      prisma.contact.count({ where }),
    ]);

    return [contacts, totalCount];
  }

  const valueColumn = valueColumnForKind(definition.kind);
  const skip = (params.page - 1) * params.pageSize;

  const [totalCount, valuedCount] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contactFieldValue.count({ where: { definitionId: definition.id, contact: where } }),
  ]);

  // The page window straddles two blocks: rows that have a value, then rows that don't.
  const valuedTake = Math.max(0, Math.min(params.pageSize, valuedCount - skip));
  const emptySkip = Math.max(0, skip - valuedCount);
  const emptyTake = params.pageSize - valuedTake;

  const [valuedRows, emptyRows] = await Promise.all([
    valuedTake > 0
      ? prisma.contactFieldValue.findMany({
          where: { definitionId: definition.id, contact: where },
          orderBy: [{ [valueColumn]: params.direction }, { contactId: "asc" }],
          skip: Math.min(skip, valuedCount),
          take: valuedTake,
          select: { contactId: true },
        })
      : Promise.resolve([]),
    emptyTake > 0
      ? prisma.contact.findMany({
          where: { AND: [where, { customFieldValues: { none: { definitionId: definition.id } } }] },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          skip: emptySkip,
          take: emptyTake,
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const orderedIds = [
    ...valuedRows.map((row) => row.contactId),
    ...emptyRows.map((row) => row.id),
  ];

  if (orderedIds.length === 0) {
    return [[], totalCount];
  }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: orderedIds } },
    include: ROW_INCLUDE,
  });

  // `IN` gives no ordering guarantee, so the page order is restored from the ids.
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

  return [
    orderedIds
      .map((id) => contactById.get(id))
      .filter((contact): contact is ContactWithRelations => contact !== undefined),
    totalCount,
  ];
}

/**
 * The spreadsheets worth offering in the source filter.
 *
 * Counted through `buildContactVisibilityFilter` like every other contact query here, which does
 * two things at once: the number beside a filename is how many leads *this person* would actually
 * see if they picked it, and a file that produced nothing they may read is left out entirely
 * rather than advertising the team's import history to a salesperson.
 */
export async function listImportBatchOptions(
  member: CurrentMember,
): Promise<{ id: string; filename: string; addedOn: string; leadCount: number }[]> {
  const visibility = await buildContactVisibilityFilter(member);

  const grouped = await prisma.contact.groupBy({
    by: ["originBatchId"],
    where: { AND: [visibility, { originBatchId: { not: null } }] },
    _count: { _all: true },
  });

  if (grouped.length === 0) {
    return [];
  }

  const countByBatch = new Map(
    grouped.map((group) => [group.originBatchId as string, group._count._all]),
  );

  const batches = await prisma.importBatch.findMany({
    where: { id: { in: [...countByBatch.keys()] } },
    orderBy: { createdAt: "desc" },
    take: MAX_BATCH_OPTIONS,
    select: { id: true, filename: true, createdAt: true },
  });

  return batches.map((batch) => ({
    id: batch.id,
    filename: batch.filename,
    // Formatted here rather than in the dropdown: the picker is a Client Component, and a date
    // rendered against the browser's locale would disagree with every other date on the page.
    addedOn: batch.createdAt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    leadCount: countByBatch.get(batch.id) ?? 0,
  }));
}

/**
 * The numbers on the tabs.
 *
 * Deliberately ignores the stage, due and archived filters — a tab showing its own count after
 * that count has been filtered by the tab you're already on would always read the same number.
 * The owner filter and search *are* respected, because those narrow which leads you are looking
 * at rather than which slice of them.
 */
async function countFacets(
  member: CurrentMember,
  params: LeadQueryParams,
): Promise<{
  stageCounts: { stageId: string; count: number }[];
  dueTodayCount: number;
  overdueCount: number;
  archivedCount: number;
}> {
  const baseWhere = await buildScopedWhere(member, {
    ...params,
    stage: "all",
    due: "any",
    showArchived: false,
  });

  const archivedWhere = await buildScopedWhere(member, {
    ...params,
    stage: "all",
    due: "any",
    showArchived: true,
  });

  const [stageGroups, dueTodayCount, overdueCount, archivedCount] = await Promise.all([
    prisma.contact.groupBy({ by: ["stageId"], where: baseWhere, _count: { _all: true } }),
    prisma.contact.count({
      where: {
        AND: [baseWhere, { nextFollowUpAt: { gte: startOfToday(), lt: endOfToday() } }],
      },
    }),
    prisma.contact.count({
      where: {
        AND: [
          baseWhere,
          { nextFollowUpAt: { lt: startOfToday() } },
          { stage: { kind: StageKind.OPEN } },
        ],
      },
    }),
    prisma.contact.count({ where: archivedWhere }),
  ]);

  return {
    stageCounts: stageGroups.map((group) => ({
      stageId: group.stageId,
      count: group._count._all,
    })),
    dueTodayCount,
    overdueCount,
    archivedCount,
  };
}

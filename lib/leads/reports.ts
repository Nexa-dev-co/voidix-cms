import { EnquirySource, StageKind, TeamRole } from "@/generated/prisma/enums";
import type { CurrentMember } from "@/lib/auth";
import { ORIGIN_LABELS } from "@/lib/leads/leadOrigin";
import { bucketSizeDays, type ReportWindow } from "@/lib/leads/reportPeriod";
import { buildContactVisibilityFilter } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The numbers behind /admin/reports.
 *
 * Two rules hold everything together:
 *
 * 1. **Every query starts from `buildContactVisibilityFilter`.** Same invariant as the leads
 *    table — a salesperson's report must be built from their own leads and nothing else, and a
 *    report is exactly the sort of aggregate where a forgotten filter leaks a whole pipeline
 *    without anybody noticing a name they shouldn't have seen.
 *
 * 2. **Intake counts by when a lead arrived; outcomes count by when they happened.** "31 new
 *    leads" means created in the window. "12 won" means moved into a Won stage during the
 *    window, whenever the lead first arrived. Each figure then answers the question it appears
 *    to answer — the alternative, counting a March lead's win against March, makes every recent
 *    period look empty because most of its leads have not been decided yet.
 *
 * A known limitation, recorded rather than hidden: `contact_stage_changes` snapshots the stage
 * *label* as text, deliberately, so that renaming a stage doesn't rewrite history. The cost is
 * that "was this a win?" is answered by matching those snapshots against the labels currently
 * marked WON — so history written before a rename stops being counted. Storing the kind on each
 * change would fix it, and would be the thing to add if renaming ever becomes common.
 */

/** A lead open for longer than this with nothing logged has gone quiet. */
const STALE_AFTER_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReportScope {
  member: CurrentMember;
  window: ReportWindow;
  /** Admin-only narrowing to one person's leads. Ignored for Sales, who only ever see their own. */
  ownerId: string | null;
}

export interface Delta {
  current: number;
  previous: number | null;
}

export interface ReportHeadline {
  newLeads: Delta;
  won: Delta;
  lost: Delta;
  /** Percentage 0–100, or null when nothing closed either way — a rate over zero deals is not 0%. */
  winRate: { current: number | null; previous: number | null };
  /** Mean days from a lead arriving to it being won. Null when nothing was won. */
  averageDaysToWin: number | null;
}

export interface StageSlice {
  label: string;
  count: number;
}

export interface SourceSlice {
  key: EnquirySource;
  label: string;
  arrived: number;
  won: number;
}

export interface TimePoint {
  /** Bucket start, ISO — formatted on the server so the axis matches the rest of the panel. */
  at: string;
  label: string;
  count: number;
}

export interface PersonRow {
  id: string;
  name: string;
  isActive: boolean;
  attempts: number;
  newLeads: number;
  won: number;
  openPipeline: number;
}

export interface HygieneCounts {
  overdue: number;
  dueToday: number;
  neverContacted: number;
  goneQuiet: number;
  staleAfterDays: number;
}

export interface LeadReport {
  headline: ReportHeadline;
  funnel: StageSlice[];
  sources: SourceSlice[];
  overTime: TimePoint[];
  people: PersonRow[];
  hygiene: HygieneCounts;
  /** True when there is genuinely nothing to report, so the page can say so once. */
  isEmpty: boolean;
}

/** The set of contacts this report may look at, before any period is applied. */
async function buildScope(scope: ReportScope): Promise<Prisma.ContactWhereInput> {
  const visibility = await buildContactVisibilityFilter(scope.member);

  // The person filter is a convenience for an admin, never a way for Sales to widen their view:
  // for them the visibility filter has already decided, and this can only narrow further.
  const ownerId = scope.member.role === TeamRole.ADMIN ? scope.ownerId : null;

  return ownerId ? { AND: [visibility, { assignedToId: ownerId }] } : visibility;
}

function within(from: Date | null, to: Date): Prisma.DateTimeFilter | undefined {
  return from ? { gte: from, lt: to } : undefined;
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Contacts moved into one of the given stages during a window, each counted once.
 *
 * `distinct` matters: a lead pushed to Won, pulled back and won again is one win, and without it
 * the win rate quietly inflates every time somebody corrects a mis-click. Ordered ascending so
 * the row kept is the *first* such move, which is the one "how long did that take?" means.
 */
async function closedInWindow(
  where: Prisma.ContactWhereInput,
  stageLabels: string[],
  from: Date | null,
  to: Date,
): Promise<{ contactId: string; closedAt: Date; arrivedAt: Date }[]> {
  if (stageLabels.length === 0) {
    return [];
  }

  const createdAt = within(from, to);

  const changes = await prisma.contactStageChange.findMany({
    where: {
      contact: where,
      toStage: { in: stageLabels },
      ...(createdAt ? { createdAt } : {}),
    },
    orderBy: [{ contactId: "asc" }, { createdAt: "asc" }],
    distinct: ["contactId"],
    select: { contactId: true, createdAt: true, contact: { select: { createdAt: true } } },
  });

  return changes.map((change) => ({
    contactId: change.contactId,
    closedAt: change.createdAt,
    arrivedAt: change.contact.createdAt,
  }));
}

export async function buildLeadReport(scope: ReportScope): Promise<LeadReport> {
  const where = await buildScope(scope);
  const { window } = scope;

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, kind: true, isActive: true },
  });

  const wonLabels = stages.filter((stage) => stage.kind === StageKind.WON).map((s) => s.label);
  const lostLabels = stages.filter((stage) => stage.kind === StageKind.LOST).map((s) => s.label);

  const [
    newLeadsCurrent,
    newLeadsPrevious,
    wonCurrent,
    wonPrevious,
    lostCurrent,
    lostPrevious,
    funnel,
    sources,
    overTime,
    hygiene,
  ] = await Promise.all([
    countCreated(where, window.from, window.to),
    window.previousFrom ? countCreated(where, window.previousFrom, window.previousTo!) : null,
    closedInWindow(where, wonLabels, window.from, window.to),
    window.previousFrom
      ? closedInWindow(where, wonLabels, window.previousFrom, window.previousTo!)
      : null,
    closedInWindow(where, lostLabels, window.from, window.to),
    window.previousFrom
      ? closedInWindow(where, lostLabels, window.previousFrom, window.previousTo!)
      : null,
    buildFunnel(where, stages),
    buildSources(where, window),
    buildOverTime(where, window),
    buildHygiene(where, window.to),
  ]);

  const people =
    scope.member.role === TeamRole.ADMIN ? await buildPeople(where, window, wonCurrent) : [];

  const headline: ReportHeadline = {
    newLeads: { current: newLeadsCurrent, previous: newLeadsPrevious },
    won: { current: wonCurrent.length, previous: wonPrevious?.length ?? null },
    lost: { current: lostCurrent.length, previous: lostPrevious?.length ?? null },
    winRate: {
      current: rate(wonCurrent.length, lostCurrent.length),
      previous:
        wonPrevious && lostPrevious ? rate(wonPrevious.length, lostPrevious.length) : null,
    },
    averageDaysToWin: averageDays(wonCurrent),
  };

  return {
    headline,
    funnel,
    sources,
    overTime,
    people,
    hygiene,
    isEmpty:
      newLeadsCurrent === 0 &&
      wonCurrent.length === 0 &&
      lostCurrent.length === 0 &&
      funnel.every((slice) => slice.count === 0),
  };
}

function rate(won: number, lost: number): number | null {
  const closed = won + lost;

  // Nothing closed is not a 0% win rate — it is an absent one, and rendering it as 0% reads as
  // "we lost everything" rather than "there is nothing to judge yet".
  return closed === 0 ? null : (won / closed) * 100;
}

function averageDays(wins: { closedAt: Date; arrivedAt: Date }[]): number | null {
  if (wins.length === 0) {
    return null;
  }

  const total = wins.reduce((sum, win) => sum + (win.closedAt.getTime() - win.arrivedAt.getTime()), 0);

  return Math.round(total / wins.length / DAY_MS);
}

function countCreated(
  where: Prisma.ContactWhereInput,
  from: Date | null,
  to: Date,
): Promise<number> {
  const createdAt = within(from, to);

  return prisma.contact.count({ where: createdAt ? { AND: [where, { createdAt }] } : where });
}

/**
 * The open pipeline as it stands right now.
 *
 * A snapshot rather than a period figure, and labelled as one on the page: "how many leads are
 * sitting in Qualified" is a question about today, and there is no useful reading of it that is
 * scoped to a window. Won and Lost are excluded — a funnel is the work still in flight, and the
 * outcomes have their own tiles with their own colours.
 */
async function buildFunnel(
  where: Prisma.ContactWhereInput,
  stages: { id: string; label: string; kind: StageKind; isActive: boolean }[],
): Promise<StageSlice[]> {
  const grouped = await prisma.contact.groupBy({
    by: ["stageId"],
    where: { AND: [where, { isArchived: false }] },
    _count: { _all: true },
  });

  const countByStage = new Map(grouped.map((row) => [row.stageId, row._count._all]));

  // A retired stage still holding leads keeps its row, because those leads are real and hiding
  // them makes the funnel add up to less than the pipeline does.
  return stages
    .filter((stage) => stage.kind === StageKind.OPEN)
    .filter((stage) => stage.isActive || (countByStage.get(stage.id) ?? 0) > 0)
    .map((stage) => ({ label: stage.label, count: countByStage.get(stage.id) ?? 0 }));
}

async function buildSources(
  where: Prisma.ContactWhereInput,
  window: ReportWindow,
): Promise<SourceSlice[]> {
  const createdAt = within(window.from, window.to);

  const [arrived, wonBySource] = await Promise.all([
    prisma.contact.groupBy({
      by: ["originSource"],
      where: createdAt ? { AND: [where, { createdAt }] } : where,
      _count: { _all: true },
    }),
    wonContactsBySource(where, window),
  ]);

  const arrivedBy = new Map(arrived.map((row) => [row.originSource, row._count._all]));

  // Every channel gets a row even at zero. A source that produced nothing this period is a
  // finding; leaving it out makes the chart look like it was never configured.
  return (Object.keys(ORIGIN_LABELS) as EnquirySource[]).map((key) => ({
    key,
    label: ORIGIN_LABELS[key],
    arrived: arrivedBy.get(key) ?? 0,
    won: wonBySource.get(key) ?? 0,
  }));
}

async function wonContactsBySource(
  where: Prisma.ContactWhereInput,
  window: ReportWindow,
): Promise<Map<EnquirySource, number>> {
  const stages = await prisma.pipelineStage.findMany({
    where: { kind: StageKind.WON },
    select: { label: true },
  });

  const wins = await closedInWindow(
    where,
    stages.map((stage) => stage.label),
    window.from,
    window.to,
  );

  if (wins.length === 0) {
    return new Map();
  }

  const grouped = await prisma.contact.groupBy({
    by: ["originSource"],
    where: { id: { in: wins.map((win) => win.contactId) } },
    _count: { _all: true },
  });

  return new Map(grouped.map((row) => [row.originSource, row._count._all]));
}

/**
 * New leads over the window, bucketed.
 *
 * Dates are pulled and grouped here rather than in SQL because grouping by a date expression
 * needs raw SQL, and a raw query would compose its own `WHERE` — stepping around the one
 * visibility filter every other query in this file is built on. The row cap on imports keeps the
 * result small enough that the trade is worth it.
 */
async function buildOverTime(
  where: Prisma.ContactWhereInput,
  window: ReportWindow,
): Promise<TimePoint[]> {
  const createdAt = within(window.from, window.to);

  const contacts = await prisma.contact.findMany({
    where: createdAt ? { AND: [where, { createdAt }] } : where,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const first = window.from ?? contacts[0]?.createdAt ?? window.to;
  const bucketDays = bucketSizeDays(window.key, first, window.to);
  const bucketMs = bucketDays * DAY_MS;

  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime();
  const bucketCount = Math.max(1, Math.ceil((window.to.getTime() - start) / bucketMs));
  const counts = new Array<number>(bucketCount).fill(0);

  for (const contact of contacts) {
    const index = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((contact.createdAt.getTime() - start) / bucketMs)),
    );
    counts[index] += 1;
  }

  return counts.map((count, index) => {
    const at = new Date(start + index * bucketMs);

    return {
      at: at.toISOString(),
      label: at.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      count,
    };
  });
}

/**
 * One row per team member.
 *
 * A win counts for whoever owns the lead now, not whoever moved it — that keeps this table and
 * the leads list's Owner column telling the same story, and stops an admin closing a deal on
 * somebody's behalf from taking the win off them.
 */
async function buildPeople(
  where: Prisma.ContactWhereInput,
  window: ReportWindow,
  wins: { contactId: string }[],
): Promise<PersonRow[]> {
  const createdAt = within(window.from, window.to);
  const wonIds = wins.map((win) => win.contactId);

  const [members, attempts, newLeads, wonByOwner, openByOwner] = await Promise.all([
    prisma.teamMember.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
    prisma.contactAttempt.groupBy({
      by: ["memberId"],
      where: { contact: where, ...(createdAt ? { createdAt } : {}) },
      _count: { _all: true },
    }),
    prisma.contact.groupBy({
      by: ["assignedToId"],
      where: createdAt ? { AND: [where, { createdAt }] } : where,
      _count: { _all: true },
    }),
    wonIds.length > 0
      ? prisma.contact.groupBy({
          by: ["assignedToId"],
          where: { id: { in: wonIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    prisma.contact.groupBy({
      by: ["assignedToId"],
      where: { AND: [where, { isArchived: false }, { stage: { kind: StageKind.OPEN } }] },
      _count: { _all: true },
    }),
  ]);

  const attemptsBy = new Map(attempts.map((row) => [row.memberId, row._count._all]));
  const newLeadsBy = new Map(newLeads.map((row) => [row.assignedToId, row._count._all]));
  const wonBy = new Map(wonByOwner.map((row) => [row.assignedToId, row._count._all]));
  const openBy = new Map(openByOwner.map((row) => [row.assignedToId, row._count._all]));

  const rows = members.map((member) => ({
    id: member.id,
    name: member.name,
    isActive: member.isActive,
    attempts: attemptsBy.get(member.id) ?? 0,
    newLeads: newLeadsBy.get(member.id) ?? 0,
    won: wonBy.get(member.id) ?? 0,
    openPipeline: openBy.get(member.id) ?? 0,
  }));

  // Unassigned leads are nobody's row, but they are somebody's problem — surfaced as a final
  // line rather than silently dropped, because a pile of them is the thing an admin needs to see.
  const unassignedOpen = openBy.get(null) ?? 0;
  const unassignedNew = newLeadsBy.get(null) ?? 0;

  if (unassignedOpen > 0 || unassignedNew > 0) {
    rows.push({
      id: "unassigned",
      name: "Unassigned",
      isActive: true,
      attempts: 0,
      newLeads: unassignedNew,
      won: wonBy.get(null) ?? 0,
      openPipeline: unassignedOpen,
    });
  }

  // A former colleague with nothing recorded in this window is noise; one with history is not.
  return rows.filter(
    (row) => row.isActive || row.attempts > 0 || row.newLeads > 0 || row.won > 0 || row.openPipeline > 0,
  );
}

/**
 * What is rotting, right now.
 *
 * Deliberately ignores the period. "Overdue" is a fact about today, and a version of it scoped
 * to the last 7 days would answer a question nobody asks.
 */
async function buildHygiene(
  where: Prisma.ContactWhereInput,
  now: Date,
): Promise<HygieneCounts> {
  const today = startOfToday(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS);

  const openAndLive: Prisma.ContactWhereInput = {
    AND: [where, { isArchived: false }, { stage: { kind: StageKind.OPEN } }],
  };

  const [overdue, dueToday, neverContacted, goneQuiet] = await Promise.all([
    prisma.contact.count({
      where: { AND: [openAndLive, { nextFollowUpAt: { lt: today } }] },
    }),
    prisma.contact.count({
      where: { AND: [openAndLive, { nextFollowUpAt: { gte: today, lt: tomorrow } }] },
    }),
    prisma.contact.count({
      where: { AND: [openAndLive, { attempts: { none: {} } }] },
    }),
    prisma.contact.count({
      where: {
        AND: [
          openAndLive,
          // Has been tried at least once, but not lately. A lead never tried at all is the
          // previous figure's problem, and counting it in both would double-report one lead.
          { attempts: { some: {} } },
          { attempts: { none: { createdAt: { gte: staleBefore } } } },
        ],
      },
    }),
  ]);

  return { overdue, dueToday, neverContacted, goneQuiet, staleAfterDays: STALE_AFTER_DAYS };
}

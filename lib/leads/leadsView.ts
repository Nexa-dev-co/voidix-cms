import type { EnquirySource, StageKind } from "@/generated/prisma/enums";
import type { CustomFieldCell } from "@/lib/leads/customFieldTypes";
import { ANY_SOURCE, normaliseSourceParam } from "@/lib/leads/leadOrigin";

/**
 * The leads table's view state: what the URL says, and what one row looks like once loaded.
 *
 * Deliberately free of any database import, because the table is a Client Component and needs
 * `buildLeadsHref` as a real function. Passing it down as a prop is not an option — a function
 * cannot cross the server/client boundary unless it is a Server Action.
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
/**
 * 25 rather than 50, because the page scrolls rather than the table.
 *
 * Every row on a page is a row you scroll past; fifty of them made the leads page roughly four
 * screens long. The larger sizes are one click away in the footer and stick in the URL.
 */
export const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 120;

/**
 * "Assign these to nobody", as posted by the bulk bar.
 *
 * A word rather than an empty string, because the bar keeps its button disabled until a choice is
 * made and therefore needs "" to go on meaning "nothing chosen".
 */
export const UNASSIGN_SENTINEL = "unassign";

/**
 * The colour of a stage tag on the leads list.
 *
 * Shared by the table and the phone cards, which show the same tag in two layouts — keeping a
 * copy in each is how Won ends up green in one place and grey in the other. Keyed loosely by
 * string so an unrecognised kind falls back to OPEN rather than rendering unstyled.
 *
 * Not the same map as the one on the lead's own page: that styles a *selected* stage button and
 * wants a solid border, which would be shouting if every row in a list did it.
 */
export const STAGE_TONES: Record<string, string> = {
  OPEN: "border-border-strong text-muted",
  WON: "border-success/40 bg-success/10 text-success",
  LOST: "border-danger/30 bg-danger/10 text-danger",
};

export type OwnerFilter = "everyone" | "mine" | "unassigned";
export type DueFilter = "any" | "today" | "overdue";

export interface LeadQueryParams {
  /** A stage id, "all", or "open" for everything not Won/Lost. */
  stage: string;
  owner: OwnerFilter;
  /** "any", an `EnquirySource`, or `batch:<id>` for one spreadsheet. See `parseSourceFilter`. */
  source: string;
  due: DueFilter;
  showArchived: boolean;
  search: string;
  sort: string;
  direction: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  stageLabel: string;
  stageKind: StageKind;
  /** How they got here, already resolved — see `summariseOrigin`. */
  sourceChannel: EnquirySource;
  sourceLabel: string;
  /** The spreadsheet they arrived in, or the campaign the site tagged them with. */
  sourceDetail: string | null;
  addedByName: string | null;
  ownerName: string | null;
  nextFollowUpAt: string | null;
  isOverdue: boolean;
  lastAttemptAt: string | null;
  lastAttemptSummary: string | null;
  touchpointCount: number;
  createdAt: string;
  isArchived: boolean;
  customCells: CustomFieldCell[];
}

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];

  return typeof value === "string" ? value : "";
}

/** Everything the table's state is read from, normalised and bounded. */
export function parseLeadQueryParams(
  searchParams: Record<string, string | string[] | undefined>,
): LeadQueryParams {
  const rawOwner = readParam(searchParams, "owner");
  const rawDue = readParam(searchParams, "due");
  const rawSize = Number(readParam(searchParams, "size"));
  const rawPage = Number(readParam(searchParams, "page"));

  return {
    stage: readParam(searchParams, "stage") || "all",
    owner:
      rawOwner === "mine" || rawOwner === "unassigned" || rawOwner === "everyone"
        ? rawOwner
        : "everyone",
    // Normalised here rather than at the query, so a mistyped `source` never reaches the
    // database and never survives into the links this page builds from these params.
    source: normaliseSourceParam(readParam(searchParams, "source")),
    due: rawDue === "today" || rawDue === "overdue" ? rawDue : "any",
    showArchived: readParam(searchParams, "archived") === "1",
    search: readParam(searchParams, "q").slice(0, MAX_SEARCH_LENGTH).trim(),
    sort: readParam(searchParams, "sort") || "createdAt",
    direction: readParam(searchParams, "dir") === "asc" ? "asc" : "desc",
    // A hand-edited page number must not produce a negative `skip`, which Prisma rejects.
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(rawSize)
      ? rawSize
      : DEFAULT_PAGE_SIZE,
  };
}

/**
 * Rebuilds the table's URL with some parameters changed. Every tab, sortable header and pager
 * link goes through this, so the shape of the query string is decided once.
 *
 * Anything other than an explicit page change drops back to page one: staying on page 7 of a
 * list that now has two pages shows an empty table and reads as a bug.
 */
export function buildLeadsHref(
  params: LeadQueryParams,
  overrides: Partial<LeadQueryParams>,
): string {
  const merged = { ...params, ...overrides, page: overrides.page ?? 1 };
  const query = new URLSearchParams();

  if (merged.stage !== "all") {
    query.set("stage", merged.stage);
  }
  if (merged.owner !== "everyone") {
    query.set("owner", merged.owner);
  }
  if (merged.source !== ANY_SOURCE) {
    query.set("source", merged.source);
  }
  if (merged.due !== "any") {
    query.set("due", merged.due);
  }
  if (merged.showArchived) {
    query.set("archived", "1");
  }
  if (merged.search.length > 0) {
    query.set("q", merged.search);
  }
  if (merged.sort !== "createdAt") {
    query.set("sort", merged.sort);
  }
  if (merged.direction !== "desc") {
    query.set("dir", merged.direction);
  }
  if (merged.page > 1) {
    query.set("page", String(merged.page));
  }
  if (merged.pageSize !== DEFAULT_PAGE_SIZE) {
    query.set("size", String(merged.pageSize));
  }

  const queryString = query.toString();

  return queryString.length > 0 ? `/admin/leads?${queryString}` : "/admin/leads";
}

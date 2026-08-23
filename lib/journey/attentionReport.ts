import "server-only";

import { prisma } from "@/lib/prisma";
import type { ActivityWindow } from "@/lib/journey/activityWindow";
// ⚠ The sort lives with the URL state, not here. It is parsed from a query string by a Client
// Component and consumed by this server module, so defining it twice would let the two drift into
// disagreeing about which values are legal.
import type { AttentionSort } from "@/lib/journey/activityView";

/**
 * What visitors actually touched, in detail — the report behind `/user-activity/attention`.
 *
 * ── ⚠ IT IS SEPARATE FROM `activityReport.ts` ON PURPOSE ───────────────────────────────────────
 * That file builds the OVERVIEW: nine queries, all of them scoped only by a date window, all of them
 * run on every load of the dashboard. This one is scoped by up to four filters and is read by one
 * page that somebody has deliberately navigated to. Folding these queries into the overview would
 * make the landing page pay for detail nobody asked for yet.
 *
 * ── ⚠ IT DEPENDS ON SCHEMA v3, AND ON NOTHING ELSE ─────────────────────────────────────────────
 * Before v3 the two cursor events carried no `section`, so every cursor row in `journey_events` has
 * `section = NULL` and this page can say *what* was touched but not *where*. Rows recorded before
 * the site shipped v3 therefore group under "Unknown" — they are not wrong, they are older than the
 * question. See `docs/journey-attention-plan.md`.
 *
 * ── ⚠ THE STOP JOIN IS POSITIONAL AND RESOLVES AGAINST TODAY ───────────────────────────────────
 * `stopIndex` is an array position in the published payload, so it is matched to the Nth row of
 * `services` / `projects` ordered by `sortOrder` — NOT to `sortOrder` as a value, which is free to
 * be sparse. The consequence is that reordering projects re-points historical rows at whatever now
 * occupies that slot. Every consumer of `stopName` has to say so out loud rather than presenting it
 * as what the visitor saw.
 */

/** The two events this page is built from. Nothing else in the taxonomy describes an element. */
const CURSOR_EVENT_NAMES = ["cursor:hover", "cursor:click"];

/** A page of rows, not the whole table — one busy month would otherwise render thousands of tr. */
export const ATTENTION_PAGE_SIZE = 60;

export interface AttentionRowDetail {
  /** The site's `data-journey` label when it has one, else the structural fallback. */
  target: string;
  /** Null on rows recorded before schema v3 — see the header. */
  section: string | null;
  carousel: string | null;
  stopIndex: number | null;
  /**
   * The service or project sitting at `stopIndex` TODAY. Null when there is no stop, or when the
   * index points past the end of the current list — which is itself worth seeing, because it means
   * something was removed since the visit.
   */
  stopName: string | null;
  sessions: number;
  hovers: number;
  /** Median rather than mean: one idle tab drags an average into fiction. Null when never hovered. */
  medianDwellMs: number | null;
  clicks: number;
  deadClicks: number;
  rageClicks: number;
}

export interface FaqQuestionRow {
  entryIndex: number;
  /** Resolved against today's ordering, exactly like `stopName`. Null once an entry is deleted. */
  question: string | null;
  opens: number;
  sessions: number;
}

export interface AttentionFilters {
  /** A section key, or "" for every section. */
  section: string;
  /** A route, or "" for every route. */
  route: string;
  sort: AttentionSort;
}

export interface AttentionReport {
  rows: AttentionRowDetail[];
  faq: FaqQuestionRow[];
  /** Every section and route present in the window, so the filter row offers only what exists. */
  sections: string[];
  routes: string[];
  /** True when the window holds no cursor events at all, filters aside. */
  isEmpty: boolean;
  /**
   * ⚠ How many rows predate schema v3. The page states it rather than hiding it: a reader who sees
   * half their targets under "Unknown" needs to know it is a version boundary and not a bug.
   */
  unplacedRows: number;
}

interface CursorAggregateRow {
  target: string | null;
  section: string | null;
  carousel: string | null;
  stop_index: number | null;
  sessions: number;
  hovers: number;
  median_dwell_ms: number | null;
  clicks: number;
  dead_clicks: number;
  rage_clicks: number;
}

/**
 * ⚠ `received_at`, NEVER `occurred_at`. The browser's clock is stored untrusted and a visitor with a
 * wrong timezone would otherwise fall outside — or inside — a window they had nothing to do with.
 * Same rule as every query in `activityReport.ts`.
 */
function windowClause(window: ActivityWindow) {
  return window.from
    ? { gte: window.from, lte: window.to }
    : { lte: window.to };
}

export async function buildAttentionReport(
  window: ActivityWindow,
  filters: AttentionFilters,
): Promise<AttentionReport> {
  const receivedAt = windowClause(window);

  const [aggregates, faq, facets, unplacedRows, totalRows] = await Promise.all([
    queryCursorAggregates(window, filters),
    queryFaqQuestions(window),
    queryFacets(receivedAt),
    prisma.journeyEvent.count({
      where: { name: { in: CURSOR_EVENT_NAMES }, section: null, receivedAt },
    }),
    prisma.journeyEvent.count({
      where: { name: { in: CURSOR_EVENT_NAMES }, receivedAt },
    }),
  ]);

  const stopNames = await loadStopNames();

  const rows: AttentionRowDetail[] = aggregates.map((row) => ({
    target: row.target ?? "unknown",
    section: row.section,
    carousel: row.carousel,
    stopIndex: row.stop_index,
    stopName: resolveStopName(stopNames, row.carousel, row.stop_index),
    sessions: Number(row.sessions),
    hovers: Number(row.hovers),
    medianDwellMs: row.median_dwell_ms === null ? null : Number(row.median_dwell_ms),
    clicks: Number(row.clicks),
    deadClicks: Number(row.dead_clicks),
    rageClicks: Number(row.rage_clicks),
  }));

  return {
    rows,
    faq,
    sections: facets.sections,
    routes: facets.routes,
    isEmpty: totalRows === 0,
    unplacedRows,
  };
}

/**
 * One pass over the cursor events, grouped by the element AND where it was.
 *
 * ⚠ GROUPED BY THE STOP TOO, which fragments a target that appears at several stops into several
 * rows — and that is the entire point of the page. The same `Start this build` button sits on all
 * four craft in the fleet, and "it was clicked forty times" is a fact nobody can act on until it is
 * split into which craft.
 *
 * ⚠ Raw SQL because of `percentile_cont`: Prisma has no median, and computing one in TypeScript
 * means transferring every hover row in the window to do it.
 */
async function queryCursorAggregates(
  window: ActivityWindow,
  filters: AttentionFilters,
): Promise<CursorAggregateRow[]> {
  const from = window.from ?? new Date(0);
  const section = filters.section || null;
  const route = filters.route || null;

  /**
   * ⚠ The ORDER BY is a CASE over a parameter rather than string interpolation. `$queryRaw` is
   * parameterised and a column name cannot be a parameter, so the alternative is building SQL by
   * concatenation — which is how an admin filter becomes an injection point.
   */
  return prisma.$queryRaw<CursorAggregateRow[]>`
    SELECT
      detail->>'target'                AS target,
      section,
      detail->>'carousel'              AS carousel,
      CASE WHEN detail->>'stopIndex' ~ '^[0-9]+$'
           THEN (detail->>'stopIndex')::int END AS stop_index,
      COUNT(DISTINCT session_id)::int  AS sessions,
      COUNT(*) FILTER (WHERE name = 'cursor:hover')::int AS hovers,
      (percentile_cont(0.5) WITHIN GROUP (
        ORDER BY CASE
          WHEN name = 'cursor:hover' AND detail->>'dwellMs' ~ '^[0-9]+$'
          THEN (detail->>'dwellMs')::numeric
        END
      ))::int AS median_dwell_ms,
      COUNT(*) FILTER (WHERE name = 'cursor:click')::int AS clicks,
      COUNT(*) FILTER (WHERE name = 'cursor:click' AND detail->>'isDead' = 'true')::int AS dead_clicks,
      COUNT(*) FILTER (WHERE name = 'cursor:click' AND detail->>'isRage' = 'true')::int AS rage_clicks
    FROM journey_events
    WHERE name IN ('cursor:hover', 'cursor:click')
      AND received_at >= ${from}
      AND received_at <= ${window.to}
      AND (${section}::text IS NULL OR section = ${section})
      AND (${route}::text IS NULL OR route = ${route})
      AND detail->>'target' IS NOT NULL
    GROUP BY 1, 2, 3, 4
    ORDER BY
      CASE WHEN ${filters.sort} = 'dwell' THEN
        (percentile_cont(0.5) WITHIN GROUP (
          ORDER BY CASE
            WHEN name = 'cursor:hover' AND detail->>'dwellMs' ~ '^[0-9]+$'
            THEN (detail->>'dwellMs')::numeric
          END
        ))
      END DESC NULLS LAST,
      CASE WHEN ${filters.sort} = 'friction' THEN
        COUNT(*) FILTER (WHERE name = 'cursor:click' AND detail->>'isDead' = 'true')
      END DESC NULLS LAST,
      COUNT(DISTINCT session_id) DESC
    LIMIT ${ATTENTION_PAGE_SIZE}
  `;
}

/**
 * Which questions people actually open.
 *
 * ⚠ NO SITE CHANGE WAS NEEDED FOR THIS. `faq:open` has carried `entryIndex` since the event was
 * added, and the panel owns `faq_entries` — so the only thing ever missing was somebody asking.
 */
async function queryFaqQuestions(window: ActivityWindow): Promise<FaqQuestionRow[]> {
  const from = window.from ?? new Date(0);

  const rows = await prisma.$queryRaw<
    { entry_index: number | null; opens: number; sessions: number }[]
  >`
    SELECT
      CASE WHEN detail->>'entryIndex' ~ '^[0-9]+$'
           THEN (detail->>'entryIndex')::int END AS entry_index,
      COUNT(*)::int                   AS opens,
      COUNT(DISTINCT session_id)::int AS sessions
    FROM journey_events
    WHERE name = 'faq:open'
      AND received_at >= ${from}
      AND received_at <= ${window.to}
    GROUP BY 1
    ORDER BY opens DESC
  `;

  const entries = await prisma.faqEntry.findMany({
    orderBy: { sortOrder: "asc" },
    select: { question: true },
  });

  return rows
    .filter((row): row is { entry_index: number; opens: number; sessions: number } =>
      row.entry_index !== null,
    )
    .map((row) => ({
      entryIndex: row.entry_index,
      question: entries[row.entry_index]?.question ?? null,
      opens: Number(row.opens),
      sessions: Number(row.sessions),
    }));
}

/** The sections and routes that actually have cursor data, so a filter can never select nothing. */
async function queryFacets(receivedAt: { gte?: Date; lte: Date }) {
  const rows = await prisma.journeyEvent.findMany({
    where: { name: { in: CURSOR_EVENT_NAMES }, receivedAt },
    select: { section: true, route: true },
    distinct: ["section", "route"],
    take: 200,
  });

  const sections = [
    ...new Set(rows.map((row) => row.section).filter((value): value is string => Boolean(value))),
  ].sort();
  const routes = [...new Set(rows.map((row) => row.route))].sort();

  return { sections, routes };
}

interface StopNames {
  services: string[];
  work: string[];
}

/**
 * ⚠ ORDERED BY `sortOrder`, THEN READ BY POSITION. The site's `stopIndex` is an index into the
 * published array, and `sortOrder` is only what decides that array's order — it is not itself the
 * index and is free to be sparse (10, 20, 30). Matching `sortOrder = stopIndex` would work by
 * accident on a freshly seeded table and silently mislabel every row after the first manual reorder.
 */
async function loadStopNames(): Promise<StopNames> {
  const [services, projects] = await Promise.all([
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.project.findMany({ orderBy: { sortOrder: "asc" }, select: { title: true } }),
  ]);

  return {
    services: services.map((service) => service.name),
    work: projects.map((project) => project.title),
  };
}

function resolveStopName(
  names: StopNames,
  carousel: string | null,
  stopIndex: number | null,
): string | null {
  if (carousel === null || stopIndex === null) return null;
  if (carousel === "services") return names.services[stopIndex] ?? null;
  if (carousel === "work") return names.work[stopIndex] ?? null;

  return null;
}

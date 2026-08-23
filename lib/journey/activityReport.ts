import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { ActivityWindow } from "@/lib/journey/activityWindow";

/**
 * What visitors actually did on the website, read back out.
 *
 * ── ⚠ THIS READS `journey_events`, WHICH THE SITE DOES NOT WRITE TO YET ─────────────────────────
 * The tables exist and this page is real, but the collector on the site is a later phase. Until it
 * ships, every figure here is legitimately zero and the page says so in as many words rather than
 * drawing empty charts. That is deliberate: an analytics page that renders a flat line is
 * indistinguishable from an analytics page that is broken, and the difference matters most on the day
 * you first look at it.
 *
 * ── ⚠ EVERY WINDOW IS BUCKETED BY `received_at`, NEVER `occurred_at` ────────────────────────────
 * `occurred_at` is the browser's clock and browsers lie — wrong timezone, wrong date, or simply set
 * by hand. It is stored because it is the only thing that can order events WITHIN one visit and give
 * an honest dwell, which the server stamp cannot: ten events flushed in one batch all land in the
 * same millisecond. It is not a fact about when anything happened in the world, and grouping a report
 * by it would let one visitor with a misconfigured laptop invent traffic in a month you were not
 * live. The column comment in the migration says the same thing.
 *
 * ── ⚠ THE LOADER FUNNEL IS THE POINT OF THIS PAGE ───────────────────────────────────────────────
 * The site gates roughly 8.8 MB of models behind an intro sequence, and nobody has ever known how
 * many people leave during it. `intro:start` is the denominator for the whole site; everything else
 * here is downstream of it.
 */

/**
 * The loader funnel, in the order a visitor meets it.
 *
 * ⚠ One list, used to build the steps AND to label them, so the event names and the words on screen
 * cannot drift apart. An earlier cut had the names in a constant and the labels in the query, which
 * is two places to rename one thing.
 */
const INTRO_FUNNEL = [
  { key: "intro:start", label: "Started loading" },
  { key: "intro:depth", label: "Got part-way" },
  { key: "intro:complete", label: "Finished loading" },
] as const;

export interface FunnelStep {
  label: string;
  /** How many distinct VISITS reached this step, not how many events fired. */
  sessions: number;
  /** Share of the first step, 0..1. Null on the first step, which has nothing to be a share of. */
  shareOfStart: number | null;
}

export interface SectionReach {
  section: string;
  sessions: number;
}

export interface ActivityHeadline {
  /** Distinct visits that began the loader. The denominator for everything else. */
  visits: number;
  /** Distinct visits that finished it. */
  completedIntro: number;
  /** 0..1, or null when nothing started. */
  completionRate: number | null;
  /** Visits that ended while the loader was still up — the number this whole feature was built for. */
  abandonedDuringIntro: number;
  /** Distinct consented visitors seen. Null when tier 2 has no rows at all. */
  knownVisitors: number | null;
}

export interface EnquiryFunnelStep {
  label: string;
  sessions: number;
  shareOfOpen: number | null;
}

export interface AttentionRow {
  /** A craft, a project, or whatever the cursor rested on long enough to count. */
  target: string;
  /** How many visits touched it. */
  sessions: number;
  /** Median rather than mean — one tab left open overnight drags an average into fiction. */
  medianDwellMs: number;
}

export interface DeviceSlice {
  tier: string;
  sessions: number;
}

export interface FrictionRow {
  target: string;
  deadClicks: number;
  rageClicks: number;
}

/** One section's cursor heatmap, already summed across every visit in the window. */
export interface HeatmapCell {
  cell: number;
  /** 0..1 against the hottest cell in the same section, so a quiet section still reads. */
  intensity: number;
}

export interface SectionHeatmap {
  section: string;
  /**
   * ⚠ CARRIED, AND GROUPED ON. Section keys are only unique WITHIN a route — `/` and `/lite` both
   * have a `contact`, and a document route's stations are its own — so summing by section alone
   * painted two pages' cursors into one picture under a name that belonged to neither.
   */
  route: string;
  cells: HeatmapCell[];
  sessions: number;
  /**
   * ⚠ THE WEIGHT BEHIND THE PICTURE, and it is carried because `intensity` deliberately destroys it.
   *
   * Every cell is normalised against its own section's hottest, so a heatmap built from ONE visit
   * and one built from four hundred are drawn with exactly the same confidence — a single cursor
   * resting once becomes a full-strength cell. That is the right call for reading shape and a
   * terrible one for judging whether the shape means anything, so the raw totals travel alongside
   * and the component refuses to draw a confident picture without them.
   */
  samples: number;
  /** Total cursor-observed time across every visit, in ms. The denominator a reader actually feels. */
  observedMs: number;
  /**
   * WHICH LAYOUT THIS PICTURE BELONGS TO, and why the grouping key gained a third part in v4.
   *
   * Cells are normalised to each visitor's own viewport, so the middle cell is "the middle of the
   * frame" on every screen — but the site renders a DIFFERENT LAYOUT below 51.25em, so the middle of
   * the frame holds different things on either side of that line. Summing them produced one picture
   * of two layouts, and any reference frame drawn under it was wrong for half the data.
   *
   * "unknown" is every row written before v4. They are not wrong, they are older than the question.
   */
  layout: HeatmapLayout;
  /**
   * ⚠ TRUE WHEN THE LAYOUT WAS RECOVERED RATHER THAN MEASURED.
   *
   * A grid written before v4 recorded no viewport, but its SESSION very often still has a
   * `device:profile` event carrying one — so the shape is recoverable instead of lost. What cannot
   * be recovered is the browser's own answer to an `em` media query, so the narrow/wide split is
   * re-derived from pixels against `INFERRED_NARROW_MAX_PX`, which is an approximation. Every
   * surface that draws a frame off an inferred layout has to say that it did.
   */
  isLayoutInferred: boolean;
  /**
   * The actual screens behind this picture, biggest contributor first.
   *
   * ⚠ THIS IS WHAT LETS THE MIMIC BE DRAWN AT THE RIGHT SHAPE. A heatmap cell is a fraction of the
   * visitor's own viewport, so the grid itself is aspect-independent — but any reference frame drawn
   * under it is NOT. Forcing a 16:9 box for a reader whose visitors were all on 16:10 laptops puts
   * every region a few percent off, in the one direction nobody would think to check.
   *
   * ⚠ It does NOT split the heatmap. Grouping by exact pixel size would shatter the data into a card
   * per monitor; the sizes are carried so the frame can be shaped and the spread can be stated.
   */
  viewports: ViewportShape[];
}

/** One distinct screen size that contributed to a heatmap. */
export interface ViewportShape {
  width: number;
  height: number;
  /** How many section-summaries came from a screen this size. */
  grids: number;
}

/**
 * THE SITE'S OWN CLASSES, not sizes invented here.
 *
 * "wide" and "narrow" are the two sides of (max-width: 51.25em) as the VISITOR'S BROWSER answered
 * it, carried on the grid. Nothing in this panel re-derives them from a pixel width, because that
 * query is in em and moves with the visitor's root font size.
 */
export type HeatmapLayout = "wide" | "narrow" | "unknown";

/** One point on the visits-over-time chart. */
export interface VisitPoint {
  /** Already formatted for the axis — the server owns the timezone, so the client cannot disagree. */
  label: string;
  visits: number;
}

export interface ActivityReport {
  /** True when there is not one event in the window — drives the honest empty state. */
  isEmpty: boolean;
  headline: ActivityHeadline;
  introFunnel: FunnelStep[];
  sectionReach: SectionReach[];
  enquiryFunnel: EnquiryFunnelStep[];
  attention: AttentionRow[];
  devices: DeviceSlice[];
  friction: FrictionRow[];
  heatmaps: SectionHeatmap[];
  /** Visits per bucket across the window, oldest first. Empty for "all time" with no lower bound. */
  trend: VisitPoint[];
  /** Rows in the whole table, ignoring the window. Distinguishes "no data yet" from "none this month". */
  totalEventsEver: number;
}

const EMPTY_HEADLINE: ActivityHeadline = {
  visits: 0,
  completedIntro: 0,
  completionRate: null,
  abandonedDuringIntro: 0,
  knownVisitors: null,
};

/**
 * Counts DISTINCT SESSIONS per event name, which is not the same question as counting rows.
 *
 * ⚠ `intro:depth` fires up to three times in one visit (25, 50, 75) and `section:arrive` fires once
 * per section — so a row count would report a visit that browsed thoroughly as several visitors. Every
 * figure a human reads off this page is "how many visits", and the distinct count is what makes that
 * true rather than approximately true.
 */
async function countSessionsByName(window: ActivityWindow): Promise<Map<string, number>> {
  const rows = await prisma.journeyEvent.findMany({
    where: window.from ? { receivedAt: { gte: window.from, lte: window.to } } : { receivedAt: { lte: window.to } },
    select: { name: true, sessionId: true },
    distinct: ["name", "sessionId"],
  });

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  return counts;
}

export async function buildActivityReport(window: ActivityWindow): Promise<ActivityReport> {
  const receivedAt = window.from
    ? { gte: window.from, lte: window.to }
    : { lte: window.to };

  const [totalEventsEver, windowEventCount] = await Promise.all([
    prisma.journeyEvent.count(),
    prisma.journeyEvent.count({ where: { receivedAt } }),
  ]);

  if (windowEventCount === 0) {
    return {
      isEmpty: true,
      headline: EMPTY_HEADLINE,
      introFunnel: [],
      sectionReach: [],
      enquiryFunnel: [],
      attention: [],
      devices: [],
      friction: [],
      heatmaps: [],
      trend: [],
      totalEventsEver,
    };
  }

  const [byName, abandoned, knownVisitorRows, sectionRows] = await Promise.all([
    countSessionsByName(window),
    // ⚠ Read off `session:end`'s own flag rather than inferred from "started but never completed".
    // The inference would count every visit still open at the moment of the query as an abandonment,
    // which on a busy site is a steady overstatement that grows with traffic.
    prisma.journeyEvent.count({
      where: { receivedAt, name: "session:end", detail: { path: ["duringIntro"], equals: true } },
    }),
    prisma.journeyEvent.findMany({
      where: { receivedAt, visitorId: { not: null } },
      select: { visitorId: true },
      distinct: ["visitorId"],
    }),
    prisma.journeyEvent.findMany({
      where: { receivedAt, name: "section:arrive", section: { not: null } },
      select: { section: true, sessionId: true },
      distinct: ["section", "sessionId"],
    }),
  ]);

  const visits = byName.get("intro:start") ?? 0;
  const completedIntro = byName.get("intro:complete") ?? 0;

  const sectionCounts = new Map<string, number>();
  for (const row of sectionRows) {
    if (!row.section) continue;
    sectionCounts.set(row.section, (sectionCounts.get(row.section) ?? 0) + 1);
  }

  const introFunnel: FunnelStep[] = INTRO_FUNNEL.map(({ key, label }) => {
    const sessions = byName.get(key) ?? 0;
    return {
      label,
      sessions,
      shareOfStart: key === "intro:start" || visits === 0 ? null : sessions / visits,
    };
  });

  const [attention, devices, friction, heatmaps, trend] = await Promise.all([
    buildAttention(receivedAt),
    buildDevices(receivedAt),
    buildFriction(receivedAt),
    buildHeatmaps(receivedAt),
    buildTrend(window),
  ]);

  const enquiryOpened = byName.get("enquiry:open") ?? 0;
  const enquiryFunnel: EnquiryFunnelStep[] = [
    { key: "enquiry:open", label: "Opened the form" },
    { key: "enquiry:start", label: "Started typing" },
    { key: "enquiry:submit", label: "Sent it" },
  ].map(({ key, label }) => {
    const sessions = byName.get(key) ?? 0;
    return {
      label,
      sessions,
      shareOfOpen:
        key === "enquiry:open" || enquiryOpened === 0 ? null : sessions / enquiryOpened,
    };
  });

  return {
    isEmpty: false,
    enquiryFunnel,
    attention,
    devices,
    friction,
    heatmaps,
    trend,
    headline: {
      visits,
      completedIntro,
      completionRate: visits === 0 ? null : completedIntro / visits,
      abandonedDuringIntro: abandoned,
      // ⚠ Null rather than 0 when nobody consented. "Nobody said yes" and "we measured nobody" are
      // different facts, and a 0 quietly conflates them — the same distinction `journey_daily`'s
      // `visitor_count` column is nullable for.
      knownVisitors: knownVisitorRows.length === 0 ? null : knownVisitorRows.length,
    },
    introFunnel,
    sectionReach: [...sectionCounts.entries()]
      .map(([section, sessions]) => ({ section, sessions }))
      .sort((left, right) => right.sessions - left.sessions),
    totalEventsEver,
  };
}

type ReceivedAtFilter = { gte?: Date; lte: Date };

/**
 * What held the cursor, and for how long.
 *
 * ⚠ MEDIAN, NOT MEAN, and computed in Postgres rather than by pulling rows into JS. One visitor who
 * left a tab open on a project overnight would drag an average into fiction — and that is the normal
 * case rather than the rare one, which is why every dwell figure in this file is a percentile.
 */
async function buildAttention(receivedAt: ReceivedAtFilter): Promise<AttentionRow[]> {
  const rows = await prisma.$queryRaw<
    { target: string; sessions: bigint; median_dwell_ms: number | null }[]
  >`
    SELECT
      detail->>'target' AS target,
      COUNT(DISTINCT session_id) AS sessions,
      (percentile_cont(0.5) WITHIN GROUP (
        ORDER BY CASE WHEN detail->>'dwellMs' ~ '^[0-9]+$' THEN (detail->>'dwellMs')::numeric END
      ))::int AS median_dwell_ms
    FROM journey_events
    WHERE name = 'cursor:hover'
      AND detail->>'target' IS NOT NULL
      AND received_at <= ${receivedAt.lte}
      ${receivedAt.gte ? Prisma.sql`AND received_at >= ${receivedAt.gte}` : Prisma.empty}
    GROUP BY 1
    ORDER BY sessions DESC
    LIMIT 12
  `;

  return rows.map((row) => ({
    target: row.target,
    sessions: Number(row.sessions),
    medianDwellMs: row.median_dwell_ms ?? 0,
  }));
}

/** What machines actually load this site — the numbers the allocator computes and threw away. */
async function buildDevices(receivedAt: ReceivedAtFilter): Promise<DeviceSlice[]> {
  const rows = await prisma.$queryRaw<{ tier: string; sessions: bigint }[]>`
    SELECT detail->>'deviceTier' AS tier, COUNT(DISTINCT session_id) AS sessions
    FROM journey_events
    WHERE name = 'device:profile'
      AND detail->>'deviceTier' IS NOT NULL
      AND received_at <= ${receivedAt.lte}
      ${receivedAt.gte ? Prisma.sql`AND received_at >= ${receivedAt.gte}` : Prisma.empty}
    GROUP BY 1
    ORDER BY sessions DESC
  `;

  return rows.map((row) => ({ tier: row.tier, sessions: Number(row.sessions) }));
}

/**
 * Clicks that went nowhere.
 *
 * ⚠ The most actionable thing on this page. A dead click is somebody expecting a control that is not
 * there; three in a second is somebody who has decided it is broken. Neither shows up in any funnel.
 */
async function buildFriction(receivedAt: ReceivedAtFilter): Promise<FrictionRow[]> {
  const rows = await prisma.$queryRaw<
    { target: string; dead_clicks: bigint; rage_clicks: bigint }[]
  >`
    SELECT
      COALESCE(detail->>'target', 'unknown') AS target,
      COUNT(*) FILTER (WHERE detail->>'isDead' = 'true') AS dead_clicks,
      COUNT(*) FILTER (WHERE detail->>'isRage' = 'true') AS rage_clicks
    FROM journey_events
    WHERE name = 'cursor:click'
      AND received_at <= ${receivedAt.lte}
      ${receivedAt.gte ? Prisma.sql`AND received_at >= ${receivedAt.gte}` : Prisma.empty}
    GROUP BY 1
    HAVING COUNT(*) FILTER (WHERE detail->>'isDead' = 'true') > 0
        OR COUNT(*) FILTER (WHERE detail->>'isRage' = 'true') > 0
    ORDER BY rage_clicks DESC, dead_clicks DESC
    LIMIT 10
  `;

  return rows.map((row) => ({
    target: row.target,
    deadClicks: Number(row.dead_clicks),
    rageClicks: Number(row.rage_clicks),
  }));
}

/**
 * The heatmaps, summed across every visit in the window.
 *
 * ⚠ Normalised PER SECTION, not globally. The hero is on screen for every visit and the chamber for
 * a fraction of them, so one global scale would render every section but the first as empty — the
 * question each heatmap answers is "where within THIS scene", not "which scene is busiest", which
 * the section funnel already answers properly.
 */
/**
 * Visits per bucket across the window, oldest first.
 *
 * ── ⚠ ONE ROW PER SESSION, NOT ONE PER EVENT ───────────────────────────────────────────────────
 * A visit that browses thoroughly emits forty events and a visit that bounces emits three, so
 * charting rows would draw engagement and label it traffic. `MIN(received_at)` per session is when
 * that visit ARRIVED, which is the thing a traffic line is supposed to show.
 *
 * ⚠ Bucketed by `received_at`, like every other figure here — see the module header on why the
 * browser's own clock is never allowed to decide which day something belongs to.
 *
 * ⚠ EMPTY BUCKETS ARE FILLED IN. Postgres returns no row for a day nobody visited, and a line chart
 * fed only the days with traffic draws a straight segment across a gap — which reads as steady
 * traffic through exactly the period that had none. The zero-fill is what makes the shape true.
 */
async function buildTrend(window: ActivityWindow): Promise<VisitPoint[]> {
  // "All time" has no lower bound to start bucketing from, and a chart spanning an unknown range
  // cannot pick a sensible bucket. The rest of the page still answers for all time.
  if (!window.from) return [];

  const from = window.from;
  const to = window.to;

  const rows = await prisma.$queryRaw<{ bucket: Date; visits: bigint }[]>`
    SELECT date_trunc(${window.bucket}, first_seen) AS bucket, COUNT(*)::bigint AS visits
      FROM (
        SELECT session_id, MIN(received_at) AS first_seen
          FROM journey_events
         WHERE received_at >= ${from} AND received_at <= ${to}
         GROUP BY session_id
      ) sessions
     GROUP BY 1
     ORDER BY 1
  `;

  const counts = new Map<number, number>();
  for (const row of rows) counts.set(startOfBucket(row.bucket, window.bucket).getTime(), Number(row.visits));

  const points: VisitPoint[] = [];
  const cursor = startOfBucket(from, window.bucket);

  // A guard rather than a `while (true)`: a clock change or a bad custom range must not spin here.
  const MAX_POINTS = 400;
  while (cursor <= to && points.length < MAX_POINTS) {
    points.push({
      label: formatBucket(cursor, window.bucket),
      visits: counts.get(cursor.getTime()) ?? 0,
    });
    advanceBucket(cursor, window.bucket);
  }

  return points;
}

/** ⚠ Must match `date_trunc`'s idea of a bucket start, or the zero-fill never finds its own rows. */
function startOfBucket(date: Date, bucket: ActivityWindow["bucket"]): Date {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  if (bucket === "hour") return start;

  start.setHours(0, 0, 0, 0);
  if (bucket === "day") return start;

  // Postgres weeks start on Monday; `getDay()` calls Sunday 0, so Sunday is six days into its week.
  const daysFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);

  return start;
}

function advanceBucket(cursor: Date, bucket: ActivityWindow["bucket"]): void {
  if (bucket === "hour") cursor.setHours(cursor.getHours() + 1);
  else if (bucket === "day") cursor.setDate(cursor.getDate() + 1);
  else cursor.setDate(cursor.getDate() + 7);
}

/** Formatted on the SERVER so the axis cannot disagree with the sentence above the chart. */
function formatBucket(date: Date, bucket: ActivityWindow["bucket"]): string {
  if (bucket === "hour") {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * ⚠ The narrow breakpoint expressed in PIXELS, for recovered rows only.
 *
 * The site's real breakpoint is `(max-width: 51.25em)`, which at a default 16px root is 820px — but
 * `em` moves with the reader's font size, so this is an approximation and never the measurement. A
 * v4+ grid carries the browser's own answer and never reaches this constant.
 */
const INFERRED_NARROW_MAX_PX = 820;

interface RecoveredViewport {
  width: number;
  height: number;
}

/**
 * Put a screen size back on grids that were recorded before v4 captured one.
 *
 * ⚠ THE DATA IS NOT LOST, IT IS JUST ON A DIFFERENT ROW. `device:profile` has carried
 * `viewportWidth`/`viewportHeight` since the taxonomy existed, once per session — so a pre-v4 grid
 * can borrow its own session's answer. Measured when this was written: 65 orphaned grids across 11
 * sessions, 12 of which had a profile with a viewport. Without this the dominant case on any panel
 * with history is "no reference frame can be drawn", which is true and useless.
 *
 * ⚠ It is a BORROW, not a measurement. The profile is stamped once per session while a grid is per
 * section, so a visitor who resized mid-visit gets the profile's shape for every section. That is
 * why everything resolved this way is flagged `isLayoutInferred` and labelled in the UI.
 */
async function recoverViewports(
  grids: { sessionId: string; viewportWidth: number | null }[],
): Promise<Map<string, RecoveredViewport>> {
  const orphaned = [...new Set(grids.filter((g) => g.viewportWidth === null).map((g) => g.sessionId))];
  if (orphaned.length === 0) return new Map();

  const profiles = await prisma.journeyEvent.findMany({
    where: { name: "device:profile", sessionId: { in: orphaned } },
    select: { sessionId: true, detail: true },
  });

  const recovered = new Map<string, RecoveredViewport>();
  for (const profile of profiles) {
    const detail = (profile.detail ?? {}) as Record<string, unknown>;
    const width = Number(detail.viewportWidth);
    const height = Number(detail.viewportHeight);
    // A profile from a coarse-pointer device cannot have produced a grid, so anything odd is skipped
    // rather than trusted — a bad shape here would misdraw the frame for a whole session.
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;
    recovered.set(profile.sessionId, { width, height });
  }

  return recovered;
}

async function buildHeatmaps(receivedAt: ReceivedAtFilter): Promise<SectionHeatmap[]> {
  const grids = await prisma.journeyCursorGrid.findMany({
    where: {
      receivedAt: receivedAt.gte
        ? { gte: receivedAt.gte, lte: receivedAt.lte }
        : { lte: receivedAt.lte },
    },
    select: {
      section: true,
      route: true,
      cells: true,
      sessionId: true,
      observedMs: true,
      viewportWidth: true,
      viewportHeight: true,
      isNarrowLayout: true,
    },
    // A ceiling rather than a page: this is summed into at most 576 numbers per section, and reading
    // every grid ever recorded to draw the same picture is how a dashboard becomes the slow page.
    take: 5000,
    orderBy: { receivedAt: "desc" },
  });

  const recovered = await recoverViewports(grids);

  // ⚠ KEYED ON ROUTE AND SECTION TOGETHER. A section key is only unique within its own route — `/`
  // and `/lite` both have a `contact`, and a document route's stations are its own entirely — so
  // grouping by section alone summed two different pages' cursors into one picture, labelled with a
  // name that described neither of them.
  const bySection = new Map<
    string,
    {
      route: string;
      section: string;
      layout: HeatmapLayout;
      isLayoutInferred: boolean;
      totals: Map<number, number>;
      sessions: Set<string>;
      observedMs: number;
      viewports: Map<string, ViewportShape>;
    }
  >();

  for (const grid of grids) {
    // ⚠ `\u0000` as an ESCAPE, never the raw byte. A literal NUL in the source made git
    // treat this whole file as binary — `git diff` refused to show it, so 517 lines of report
    // logic were unreviewable — and any editor that strips control characters would silently
    // turn the delimiter into an empty string, collapsing `/a` + `b` and `/ab` + `` into one key.
    //
    // ⚠ THE LAYOUT IS THE THIRD PART OF THE KEY, added v4. Two layouts summed into one picture
    // cannot be un-summed, and any reference frame drawn under the result is wrong for whichever
    // half of the data it does not match.
    // ⚠ The grid's OWN answer wins; the recovered one only fills a hole. A v5 grid measured its
    // layout with `matchMedia`, which is the only correct way to answer an `em` media query.
    const fallback = grid.viewportWidth === null ? recovered.get(grid.sessionId) : undefined;
    const width = grid.viewportWidth ?? fallback?.width ?? null;
    const height = grid.viewportHeight ?? fallback?.height ?? null;
    const isNarrow =
      grid.isNarrowLayout ??
      // ⚠ INFERRED, and only ever for a row that recorded nothing. Comparing pixels to 820 is the
      // approximation `NARROW_QUERY` exists to avoid — the breakpoint is in `em` and moves with the
      // reader's font size — so anything resolved this way is flagged and the UI says so.
      (fallback ? fallback.width <= INFERRED_NARROW_MAX_PX : null);

    const layout: HeatmapLayout = isNarrow === null ? "unknown" : isNarrow ? "narrow" : "wide";
    const isLayoutInferred = grid.isNarrowLayout === null && isNarrow !== null;
    const groupKey = `${grid.route}\u0000${grid.section}\u0000${layout}`;
    const entry = bySection.get(groupKey) ?? {
      route: grid.route,
      section: grid.section,
      layout,
      isLayoutInferred,
      totals: new Map(),
      sessions: new Set(),
      observedMs: 0,
      // Keyed by "WxH" so the same monitor seen twenty times is one row with a count of twenty.
      viewports: new Map<string, ViewportShape>(),
    };
    entry.sessions.add(grid.sessionId);
    entry.observedMs += grid.observedMs;
    if (width && height) {
      const key = `${width}x${height}`;
      const seen = entry.viewports.get(key);
      if (seen) seen.grids += 1;
      else
        entry.viewports.set(key, { width, height, grids: 1 });
    }

    // `cells` is JSON, so its keys are strings and its values are unknown until checked.
    for (const [cell, count] of Object.entries((grid.cells ?? {}) as Record<string, unknown>)) {
      const index = Number(cell);
      const value = Number(count);
      if (!Number.isFinite(index) || !Number.isFinite(value)) continue;
      entry.totals.set(index, (entry.totals.get(index) ?? 0) + value);
    }

    bySection.set(groupKey, entry);
  }

  return [...bySection.values()]
    .map((entry) => {
      const hottest = Math.max(...entry.totals.values(), 1);
      // ⚠ Summed BEFORE the 0.05 filter below, so it counts every sample taken rather than every
      // sample drawn. The question it answers is "how much cursor is behind this picture", and a
      // faint cell that was dropped for being a pass-through is still evidence that was gathered.
      const samples = [...entry.totals.values()].reduce((total, count) => total + count, 0);
      return {
        section: entry.section,
        route: entry.route,
        layout: entry.layout,
        isLayoutInferred: entry.isLayoutInferred,
        // ⚠ Sorted by contribution, because the frame is drawn at the FIRST one — the shape most of
        // this data actually came from, not whichever screen happened to sort first.
        viewports: [...entry.viewports.values()].sort((left, right) => right.grids - left.grids),
        sessions: entry.sessions.size,
        samples,
        observedMs: entry.observedMs,
        cells: [...entry.totals.entries()]
          .map(([cell, total]) => ({ cell, intensity: total / hottest }))
          // Below this a cell is a cursor passing through on its way somewhere, and drawing it turns
          // the heatmap into a uniform wash.
          .filter((cell) => cell.intensity > 0.05),
      };
    })
    .sort((left, right) => right.sessions - left.sessions);
}

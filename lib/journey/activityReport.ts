import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type { ReportWindow } from "@/lib/leads/reportPeriod";

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
  cells: HeatmapCell[];
  sessions: number;
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
async function countSessionsByName(window: ReportWindow): Promise<Map<string, number>> {
  const rows = await prisma.journeyEvent.findMany({
    where: window.from ? { receivedAt: { gte: window.from, lte: window.to } } : { receivedAt: { lte: window.to } },
    select: { name: true, sessionId: true },
    distinct: ["name", "sessionId"],
  });

  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.name, (counts.get(row.name) ?? 0) + 1);
  return counts;
}

export async function buildActivityReport(window: ReportWindow): Promise<ActivityReport> {
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

  const [attention, devices, friction, heatmaps] = await Promise.all([
    buildAttention(receivedAt),
    buildDevices(receivedAt),
    buildFriction(receivedAt),
    buildHeatmaps(receivedAt),
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
async function buildHeatmaps(receivedAt: ReceivedAtFilter): Promise<SectionHeatmap[]> {
  const grids = await prisma.journeyCursorGrid.findMany({
    where: {
      receivedAt: receivedAt.gte
        ? { gte: receivedAt.gte, lte: receivedAt.lte }
        : { lte: receivedAt.lte },
    },
    select: { section: true, cells: true, sessionId: true },
    // A ceiling rather than a page: this is summed into at most 576 numbers per section, and reading
    // every grid ever recorded to draw the same picture is how a dashboard becomes the slow page.
    take: 5000,
    orderBy: { receivedAt: "desc" },
  });

  const bySection = new Map<string, { totals: Map<number, number>; sessions: Set<string> }>();

  for (const grid of grids) {
    const entry = bySection.get(grid.section) ?? { totals: new Map(), sessions: new Set() };
    entry.sessions.add(grid.sessionId);

    // `cells` is JSON, so its keys are strings and its values are unknown until checked.
    for (const [cell, count] of Object.entries((grid.cells ?? {}) as Record<string, unknown>)) {
      const index = Number(cell);
      const value = Number(count);
      if (!Number.isFinite(index) || !Number.isFinite(value)) continue;
      entry.totals.set(index, (entry.totals.get(index) ?? 0) + value);
    }

    bySection.set(grid.section, entry);
  }

  return [...bySection.entries()]
    .map(([section, entry]) => {
      const hottest = Math.max(...entry.totals.values(), 1);
      return {
        section,
        sessions: entry.sessions.size,
        cells: [...entry.totals.entries()]
          .map(([cell, total]) => ({ cell, intensity: total / hottest }))
          // Below this a cell is a cursor passing through on its way somewhere, and drawing it turns
          // the heatmap into a uniform wash.
          .filter((cell) => cell.intensity > 0.05),
      };
    })
    .sort((left, right) => right.sessions - left.sessions);
}

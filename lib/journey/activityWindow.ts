/**
 * The window the activity page covers, and how it is cut into buckets.
 *
 * ── ⚠ ITS OWN MODULE, NOT `lib/leads/reportPeriod.ts`, AND THAT IS NOT DUPLICATION FOR ITS OWN SAKE ──
 * Two reasons, one of which was a live bug:
 *
 * 1 · `buildReportsHref` HARD-CODES `/reports`. The activity page was rendering the leads pages'
 *     `ReportFilters`, so **every period link on `/user-activity` navigated the reader to
 *     `/reports`.** The filters looked broken because pressing one took you to a different page
 *     entirely — which is a good part of why the page read as having no filters at all.
 *
 * 2 · The two pages ask questions at different SPEEDS. A pipeline report is a weekly and monthly
 *     instrument: nobody checks whether a lead moved stage in the last hour. Traffic is the
 *     opposite — you deploy something and want to know what happened today. So this adds `today`
 *     and `24h`, which would be noise on `/reports`, and a custom range, which that page has never
 *     needed.
 *
 * ⚠ Rolling rather than calendar-aligned, exactly as `reportPeriod` is: "last 30 days" always means
 * the last 30 days, so the page never reads zero on the 1st of a month. `today` is the deliberate
 * exception — it means since local midnight, because that is the only thing anybody means by it.
 */

export const ACTIVITY_PERIOD_KEYS = [
  "today",
  "24h",
  "7d",
  "30d",
  "90d",
  "year",
  "all",
  "custom",
] as const;

export type ActivityPeriodKey = (typeof ACTIVITY_PERIOD_KEYS)[number];

export const DEFAULT_ACTIVITY_PERIOD: ActivityPeriodKey = "30d";

/** ⚠ `custom` is absent: it is reached by picking dates, never by pressing a preset. */
export const ACTIVITY_PRESET_KEYS = ACTIVITY_PERIOD_KEYS.filter(
  (key): key is Exclude<ActivityPeriodKey, "custom"> => key !== "custom",
);

export const ACTIVITY_PERIOD_LABELS: Record<ActivityPeriodKey, string> = {
  today: "Today",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  year: "This year",
  all: "All time",
  custom: "Custom",
};

/** How the period reads inside a sentence, where the label alone would be ambiguous. */
export const ACTIVITY_PERIOD_PHRASES: Record<ActivityPeriodKey, string> = {
  today: "today",
  "24h": "the last 24 hours",
  "7d": "the last 7 days",
  "30d": "the last 30 days",
  "90d": "the last 90 days",
  year: "this year",
  all: "all time",
  custom: "the chosen dates",
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ActivityWindow {
  key: ActivityPeriodKey;
  /** Null only for "all time", which has no lower bound and nothing to compare against. */
  from: Date | null;
  to: Date;
  /** The equal-length window immediately before `from`. Null when `from` is null. */
  previousFrom: Date | null;
  previousTo: Date | null;
  /**
   * How wide one point on the trend chart is.
   *
   * ⚠ Hours for the two short windows. A day is ONE point over `today`, and a chart with one point
   * is not a chart — it is a stat tile drawn badly. This is what makes the short presets worth
   * having rather than just a smaller number.
   */
  bucket: "hour" | "day" | "week";
}

export function parseActivityPeriodKey(raw: string): ActivityPeriodKey {
  return (ACTIVITY_PERIOD_KEYS as readonly string[]).includes(raw)
    ? (raw as ActivityPeriodKey)
    : DEFAULT_ACTIVITY_PERIOD;
}

/**
 * ⚠ `YYYY-MM-DD` only, and parsed as LOCAL midnight rather than through `new Date(string)`, which
 * reads a bare date as UTC. On a UTC+3 machine that shifts every custom range three hours early and
 * quietly drops the first evening of it.
 */
function parseIsoDate(raw: string | undefined, endOfDay: boolean): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [year, month, day] = raw.split("-").map(Number);
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Resolves a period against a clock.
 *
 * `now` is a parameter rather than read inside, so every figure on one page is computed from one
 * instant — a report whose sections straddle midnight would otherwise disagree with itself.
 */
export function resolveActivityWindow(
  key: ActivityPeriodKey,
  now: Date,
  customFrom?: string,
  customTo?: string,
): ActivityWindow {
  if (key === "custom") {
    const from = parseIsoDate(customFrom, false);
    const to = parseIsoDate(customTo, true) ?? now;

    // A custom range with no usable start is not a custom range. Falling back to the default is
    // better than showing all time, which is what an unbounded query would quietly do.
    if (!from || from > to) return resolveActivityWindow(DEFAULT_ACTIVITY_PERIOD, now);

    const spanMs = to.getTime() - from.getTime();

    return {
      key,
      from,
      to,
      previousFrom: new Date(from.getTime() - spanMs),
      previousTo: from,
      bucket: bucketFor(spanMs),
    };
  }

  if (key === "all") {
    return { key, from: null, to: now, previousFrom: null, previousTo: null, bucket: "week" };
  }

  const from = startFor(key, now);
  const spanMs = now.getTime() - from.getTime();

  return {
    key,
    from,
    to: now,
    // Equal length, immediately before. For "this year" that is the same number of days ending where
    // this year began — comparing 210 days against a full 365 would make every January look like a
    // collapse.
    previousFrom: new Date(from.getTime() - spanMs),
    previousTo: from,
    bucket: bucketFor(spanMs),
  };
}

function startFor(key: Exclude<ActivityPeriodKey, "all" | "custom">, now: Date): Date {
  switch (key) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "24h":
      return new Date(now.getTime() - DAY_MS);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "7d":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "30d":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "90d":
      return new Date(now.getTime() - 90 * DAY_MS);
  }
}

/**
 * ⚠ Chosen from the SPAN, not the key, so a custom range gets the same treatment a preset of that
 * length would. The thresholds keep the point count roughly between 12 and 90 — below that the chart
 * has no shape to read, above it the marks blur into a smear and the axis labels collide.
 */
function bucketFor(spanMs: number): ActivityWindow["bucket"] {
  if (spanMs <= 2 * DAY_MS) return "hour";
  if (spanMs <= 92 * DAY_MS) return "day";

  return "week";
}

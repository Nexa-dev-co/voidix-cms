/**
 * The window a report covers, and the window it is compared against.
 *
 * Rolling rather than calendar-aligned: "last 30 days" always means the last 30 days, so the
 * page never reads zero on the 1st of a month and a number never resets under you. The
 * comparison is the equal-length window immediately before, which is what makes "up from 28%"
 * a fair statement rather than a comparison of a full month against three days of one.
 *
 * Free of any database import so the filter control and the queries agree on what a period is.
 */

export const PERIOD_KEYS = ["7d", "30d", "90d", "year", "all"] as const;

export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const DEFAULT_PERIOD: PeriodKey = "30d";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  year: "This year",
  all: "All time",
};

/** How the period reads in a sentence, where "7 days" alone would be ambiguous. */
export const PERIOD_PHRASES: Record<PeriodKey, string> = {
  "7d": "the last 7 days",
  "30d": "the last 30 days",
  "90d": "the last 90 days",
  year: "this year",
  all: "all time",
};

export interface ReportWindow {
  key: PeriodKey;
  /** Null only for "all time", which has no lower bound and therefore nothing to compare to. */
  from: Date | null;
  to: Date;
  /** The equal-length window immediately before `from`. Null when `from` is null. */
  previousFrom: Date | null;
  previousTo: Date | null;
}

export function parsePeriodKey(raw: string): PeriodKey {
  return (PERIOD_KEYS as readonly string[]).includes(raw) ? (raw as PeriodKey) : DEFAULT_PERIOD;
}

/**
 * Resolves a period key against a clock.
 *
 * `now` is a parameter rather than read inside, so a caller computing several figures uses one
 * instant for all of them — a report whose sections straddle midnight would quietly disagree
 * with itself.
 */
export function resolveWindow(key: PeriodKey, now: Date): ReportWindow {
  if (key === "all") {
    return { key, from: null, to: now, previousFrom: null, previousTo: null };
  }

  const from =
    key === "year"
      ? new Date(now.getFullYear(), 0, 1)
      : new Date(now.getTime() - periodDays(key) * DAY_MS);

  // Equal length, immediately before. For "this year" that is the same number of days ending
  // where this year began, not the whole of last year — comparing 210 days against 365 would
  // make every January look like a collapse.
  const spanMs = now.getTime() - from.getTime();

  return {
    key,
    from,
    to: now,
    previousFrom: new Date(from.getTime() - spanMs),
    previousTo: from,
  };
}

function periodDays(key: Exclude<PeriodKey, "all" | "year">): number {
  switch (key) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

/** How many buckets the over-time chart splits the window into, and how wide each one is. */
export function bucketSizeDays(key: PeriodKey, from: Date | null, to: Date): number {
  if (key === "7d") {
    return 1;
  }
  if (key === "30d") {
    return 1;
  }
  if (key === "90d") {
    return 7;
  }

  // "This year" and "all time" both stretch far enough that daily points become a smear; a
  // fortnight keeps the shape readable without inventing precision the data doesn't have.
  const spanDays = from ? Math.ceil((to.getTime() - from.getTime()) / DAY_MS) : 365;

  return spanDays > 180 ? 14 : 7;
}

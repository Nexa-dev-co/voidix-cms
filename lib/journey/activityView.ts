/**
 * The activity page's URL state.
 *
 * State lives in the URL, like the leads list and the reports page: a view is then linkable, it
 * survives a refresh, and the filter row can be a Client Component while the page stays a Server one.
 *
 * ⚠ Its own builder rather than `buildReportsHref`, which hard-codes `/reports` — see the header of
 * `activityWindow.ts` for the bug that caused.
 */

import {
  DEFAULT_ACTIVITY_PERIOD,
  parseActivityPeriodKey,
  type ActivityPeriodKey,
} from "@/lib/journey/activityWindow";

export const ACTIVITY_PATH = "/user-activity";

/**
 * ⚠ ITS OWN CONSTANT, AND `buildActivityHref` NOW TAKES A BASE PATH — because this file's header
 * describes exactly the bug that would otherwise be repeated. `buildReportsHref` hard-coded
 * `/reports`, so every period control on the activity page navigated to the leads report instead of
 * re-scoping the page being read. Hard-coding `/user-activity` here and reusing it from the
 * attention page would reproduce that, one level down.
 */
export const ATTENTION_PATH = "/user-activity/attention";

/** One section's heatmap, full size, with its reference frame and per-cell figures. */
export const HEATMAP_PATH = "/user-activity/heatmap";

/**
 * ⚠ The route goes in a QUERY PARAMETER, never a path segment.
 *
 * A route IS a path — `/`, `/about` — so putting one inside another means encoding slashes, and
 * `/user-activity/heatmap/%2F/hero` is both ugly and a source of double-decoding bugs. The layout
 * rides along because a section can have one picture per layout class and they are different data.
 */
export function buildHeatmapHref(route: string, section: string, layout: string): string {
  const query = new URLSearchParams({ route, section, layout });

  return `${HEATMAP_PATH}?${query.toString()}`;
}

export interface ActivityParams {
  period: ActivityPeriodKey;
  /** `YYYY-MM-DD`, and only meaningful when `period` is `custom`. */
  from: string;
  to: string;
}

export function parseActivityParams(
  searchParams: Record<string, string | string[] | undefined>,
): ActivityParams {
  const read = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

  return {
    period: parseActivityPeriodKey(read(searchParams.period)),
    // ⚠ Not validated into a Date here. `resolveActivityWindow` owns that, so there is one place
    // that decides what a usable range is — and it falls back rather than throwing, which keeps a
    // hand-edited URL an empty page instead of a broken one.
    from: read(searchParams.from),
    to: read(searchParams.to),
  };
}

export function buildActivityHref(
  params: ActivityParams,
  overrides: Partial<ActivityParams>,
  basePath: string = ACTIVITY_PATH,
): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();

  if (merged.period !== DEFAULT_ACTIVITY_PERIOD) query.set("period", merged.period);

  // ⚠ Carried only for `custom`. Left on a preset they would sit in the URL looking like they were
  // doing something, and would silently take effect the moment somebody switched to Custom.
  if (merged.period === "custom") {
    if (merged.from) query.set("from", merged.from);
    if (merged.to) query.set("to", merged.to);
  }

  const queryString = query.toString();

  return queryString.length > 0 ? `${basePath}?${queryString}` : basePath;
}

/** The attention page's own state: the period, plus what it is scoped and sorted by. */
export interface AttentionParams extends ActivityParams {
  section: string;
  route: string;
  sort: AttentionSort;
}

export type AttentionSort = "dwell" | "visits" | "friction";

const ATTENTION_SORTS: readonly AttentionSort[] = ["dwell", "visits", "friction"];
export const DEFAULT_ATTENTION_SORT: AttentionSort = "dwell";

export function parseAttentionParams(
  searchParams: Record<string, string | string[] | undefined>,
): AttentionParams {
  const read = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const sort = read(searchParams.sort) as AttentionSort;

  return {
    ...parseActivityParams(searchParams),
    // ⚠ Not validated against the sections that exist — the report resolves that, and a filter for a
    // section with no rows has to render as an empty table rather than as a thrown error. A
    // hand-edited URL is a bad view, never a broken page. Same rule `from`/`to` follow above.
    section: read(searchParams.section),
    route: read(searchParams.route),
    sort: ATTENTION_SORTS.includes(sort) ? sort : DEFAULT_ATTENTION_SORT,
  };
}

export function buildAttentionHref(
  params: AttentionParams,
  overrides: Partial<AttentionParams>,
): string {
  const merged = { ...params, ...overrides };
  // The period half is already solved; this only has to add what the attention page owns.
  const base = buildActivityHref(merged, {}, ATTENTION_PATH);
  const [path, existing] = base.split("?");
  const query = new URLSearchParams(existing ?? "");

  if (merged.section) query.set("section", merged.section);
  if (merged.route) query.set("route", merged.route);
  if (merged.sort !== DEFAULT_ATTENTION_SORT) query.set("sort", merged.sort);

  const queryString = query.toString();

  return queryString.length > 0 ? `${path}?${queryString}` : path;
}

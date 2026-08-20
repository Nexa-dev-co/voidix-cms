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

  return queryString.length > 0 ? `${ACTIVITY_PATH}?${queryString}` : ACTIVITY_PATH;
}

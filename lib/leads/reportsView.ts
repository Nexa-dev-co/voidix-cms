import { DEFAULT_PERIOD, parsePeriodKey, type PeriodKey } from "@/lib/leads/reportPeriod";

/**
 * The reports page's URL state.
 *
 * Same shape as `leadsView.ts` and for the same reason: the filters are Client Components and
 * need `buildReportsHref` as a real function, which cannot cross the server/client boundary as a
 * prop unless it is a Server Action.
 */

/** "Everyone" is the absence of a person filter, spelled out so the URL reads plainly. */
export const EVERYONE = "everyone";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReportParams {
  period: PeriodKey;
  /** A team member id, or "everyone". */
  owner: string;
}

export function parseReportParams(
  searchParams: Record<string, string | string[] | undefined>,
): ReportParams {
  const rawPeriod = searchParams.period;
  const rawOwner = searchParams.owner;

  return {
    period: parsePeriodKey(typeof rawPeriod === "string" ? rawPeriod : ""),
    // Validated here so a hand-edited id never reaches a `uuid` column, which Prisma answers by
    // throwing — turning a mistyped URL into a broken page rather than an empty one.
    owner:
      typeof rawOwner === "string" && UUID_PATTERN.test(rawOwner) ? rawOwner : EVERYONE,
  };
}

/** The team member to scope to, or null for everyone. */
export function ownerIdFrom(params: ReportParams): string | null {
  return params.owner === EVERYONE ? null : params.owner;
}

export function buildReportsHref(
  params: ReportParams,
  overrides: Partial<ReportParams>,
): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();

  if (merged.period !== DEFAULT_PERIOD) {
    query.set("period", merged.period);
  }
  if (merged.owner !== EVERYONE) {
    query.set("owner", merged.owner);
  }

  const queryString = query.toString();

  return queryString.length > 0 ? `/admin/reports?${queryString}` : "/admin/reports";
}

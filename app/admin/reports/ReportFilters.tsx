"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { PERIOD_KEYS, PERIOD_LABELS, type PeriodKey } from "@/lib/leads/reportPeriod";
import { buildReportsHref, type ReportParams } from "@/lib/leads/reportsView";

/**
 * One filter row above everything it scopes.
 *
 * Both controls sit here rather than on individual cards, so every chart on the page always
 * shows the same slice — per-chart filters are how two cards end up quietly disagreeing about
 * what period they are describing. State lives in the URL, like the leads list, so a view is
 * linkable and survives a refresh.
 */
export default function ReportFilters({
  params,
  people,
}: {
  params: ReportParams;
  /** Empty for Sales, who only ever see their own leads and have nobody to switch between. */
  people: { id: string; name: string }[];
}) {
  const router = useRouter();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
      <nav aria-label="Period" className="flex flex-wrap items-center gap-1">
        {PERIOD_KEYS.map((key: PeriodKey) => {
          const isActive = key === params.period;

          return (
            <Link
              key={key}
              href={buildReportsHref(params, { period: key })}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-sm px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                isActive ? "bg-card text-fg" : "text-muted hover:bg-card/50 hover:text-fg"
              }`}
            >
              {PERIOD_LABELS[key]}
            </Link>
          );
        })}
      </nav>

      {people.length > 0 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">Show reports for</span>
          <select
            value={params.owner}
            onChange={(event) => router.push(buildReportsHref(params, { owner: event.target.value }))}
            className="w-44 rounded-sm border border-border bg-field px-2.5 py-1.5 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          >
            <option value="everyone">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

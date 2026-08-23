"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ACTIVITY_PERIOD_LABELS,
  ACTIVITY_PRESET_KEYS,
  formatIsoDate,
} from "@/lib/journey/activityWindow";
import { buildActivityHref, type ActivityParams } from "@/lib/journey/activityView";

/**
 * One filter row above everything it scopes.
 *
 * ── ⚠ NOT `reports/ReportFilters`, WHICH THIS PAGE USED TO RENDER ──────────────────────────────
 * That component builds its links with `buildReportsHref`, which hard-codes `/reports` — so every
 * period on this page navigated the reader to the leads report instead of re-scoping the one they
 * were reading. A filter row that takes you somewhere else when you press it is worse than no filter
 * row, because you stop believing the page has one.
 *
 * ⚠ Presets are LINKS and the range is a form: a preset is a destination you should be able to
 * bookmark, middle-click and go back from, and only the two date inputs need JavaScript. Both write
 * to the URL, so any view here is shareable and survives a refresh.
 */
export default function ActivityFilters({
  params,
  basePath,
  extraQuery,
}: {
  params: ActivityParams;
  /**
   * ⚠ WHERE A PERIOD LINK SHOULD LAND. Defaults to the overview, which is right for the overview and
   * WRONG for every sub-page — and getting that wrong is the exact bug this file's header is about:
   * `/reports`' builder was hard-coded, so this page's period controls used to navigate the reader to
   * the leads report. The sub-pages hit the same trap one level down, sending anyone who changed the
   * period from `/user-activity/attention` back to the overview with their filters discarded.
   */
  basePath?: string;
  /**
   * The sub-page's own state, carried across a period change so it survives.
   *
   * ⚠ A plain object and not a builder function, because this is a Client Component: a function prop
   * cannot cross the server/client boundary, so the caller hands over serialisable state instead.
   */
  extraQuery?: Record<string, string>;
}) {
  const router = useRouter();
  const isCustom = params.period === "custom";
  const today = formatIsoDate(new Date());

  const hrefFor = (override: Partial<ActivityParams>) => {
    const base = buildActivityHref(params, override, basePath);
    if (!extraQuery || Object.keys(extraQuery).length === 0) return base;

    const [path, existing] = base.split("?");
    const query = new URLSearchParams(existing ?? "");
    for (const [key, value] of Object.entries(extraQuery)) {
      if (value) query.set(key, value);
    }

    return `${path}?${query.toString()}`;
  };

  const goCustom = (next: Partial<ActivityParams>) => {
    const merged = { ...params, ...next };

    // ⚠ Both ends are needed before this means anything. Navigating on the first one would reload the
    // page against a half-finished range and throw away the input that is still being filled in.
    if (!merged.from || !merged.to) return;
    router.push(hrefFor({ ...next, period: "custom" }));
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border pb-4">
      <nav aria-label="Period" className="flex flex-wrap items-center gap-1">
        {ACTIVITY_PRESET_KEYS.map((key) => {
          const isActive = key === params.period;

          return (
            <Link
              key={key}
              href={hrefFor({ period: key })}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-sm px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                isActive ? "bg-card text-fg" : "text-muted hover:bg-card/50 hover:text-fg"
              }`}
            >
              {ACTIVITY_PERIOD_LABELS[key]}
            </Link>
          );
        })}
      </nav>

      <div
        className={`flex flex-wrap items-center gap-2 rounded-sm px-2 py-1 transition-colors duration-150 ${
          isCustom ? "bg-card" : ""
        }`}
      >
        <span
          className={`text-[10px] tracking-[0.12em] uppercase ${isCustom ? "text-fg" : "text-muted"}`}
        >
          Custom
        </span>

        <label className="flex items-center gap-1.5">
          <span className="sr-only">From</span>
          <input
            type="date"
            value={params.from}
            max={params.to || today}
            onChange={(event) => goCustom({ from: event.target.value })}
            className="rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          />
        </label>

        <span aria-hidden className="text-xs text-muted">
          →
        </span>

        <label className="flex items-center gap-1.5">
          <span className="sr-only">To</span>
          <input
            type="date"
            value={params.to}
            min={params.from}
            max={today}
            onChange={(event) => goCustom({ to: event.target.value })}
            className="rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          />
        </label>
      </div>
    </div>
  );
}

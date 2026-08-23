import Link from "next/link";

import ActivityFilters from "@/app/(panel)/user-activity/ActivityFilters";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExpandableRows } from "@/components/ui/ExpandableRows";
import { requireMember } from "@/lib/auth";
import {
  buildAttentionReport,
  type AttentionReport,
  type AttentionRowDetail,
  type FaqQuestionRow,
} from "@/lib/journey/attentionReport";
import {
  ACTIVITY_PERIOD_PHRASES,
  resolveActivityWindow,
} from "@/lib/journey/activityWindow";
import {
  ACTIVITY_PATH,
  ATTENTION_PATH,
  buildAttentionHref,
  parseAttentionParams,
  type AttentionParams,
  type AttentionSort,
} from "@/lib/journey/activityView";
import { describeTargetLabel, humanise, routeLabel } from "@/lib/journey/sectionLabel";

/**
 * What held the cursor — the detail behind the overview's five-row card.
 *
 * ── ⚠ WHY IT IS A PAGE AND NOT A BIGGER CARD ───────────────────────────────────────────────────
 * The overview answers one question — did visitors get past the loader — and everything on it is
 * evidence for that. "Which of the four craft does this button get clicked on" is a different kind
 * of question: it is asked deliberately, it needs filters, and it returns tens of rows. Putting it
 * on the landing page would make every reader pay for it and would bury the headline.
 *
 * ── ⚠ EVERY FILTER IS A LINK ───────────────────────────────────────────────────────────────────
 * Section, route and sort are all discrete choices, so they are anchors and this page ships no
 * JavaScript of its own. That is `ActivityFilters`' own argument, reused: a filtered view should be
 * bookmarkable, middle-clickable and survive the back button. Only the custom date range needs a
 * client component, and it already has one.
 *
 * ⚠ `ActivityFilters` is told WHERE IT LIVES. Left to its default it builds hrefs against
 * `ACTIVITY_PATH`, so changing the period here would navigate back to the overview and throw this
 * page's filters away — the same bug its own header describes about `/reports`, one level down. It
 * takes a `basePath` and this page's scope as `extraQuery`, so a period change re-scopes the view
 * being read instead of leaving it.
 */
export const dynamic = "force-dynamic";

export default async function AttentionPage(props: PageProps<"/user-activity/attention">) {
  await requireMember();
  const searchParams = await props.searchParams;
  const params = parseAttentionParams(searchParams);

  // One instant for every figure on the page — the same rule the overview and `/reports` follow.
  const now = new Date();
  const window = resolveActivityWindow(params.period, now, params.from, params.to);
  const phrase = ACTIVITY_PERIOD_PHRASES[window.key];

  const report = await buildAttentionReport(window, {
    section: params.section,
    route: params.route,
    sort: params.sort,
  });

  return (
    <>
      <PageHeader
        eyebrow="The website"
        title="What held the cursor"
        description="Every element visitors rested on or clicked, and where on the journey it was."
        action={
          <Link
            href={ACTIVITY_PATH}
            className="shrink-0 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            ← User activity
          </Link>
        }
      />

      <ActivityFilters
        params={params}
        basePath={ATTENTION_PATH}
        extraQuery={{ section: params.section, route: params.route, sort: params.sort }}
      />

      <Scopes report={report} params={params} />

      {report.isEmpty ? (
        <p className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
          No cursor activity {phrase}. Movement is only recorded on desktop — a phone has no cursor.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          <TargetTable report={report} params={params} phrase={phrase} />
          <FaqQuestions rows={report.faq} phrase={phrase} />
        </div>
      )}
    </>
  );
}

/**
 * The scope row: which section, which route, and what to sort by.
 *
 * ⚠ Only offers values that EXIST in the window. A filter that can select an empty table is a
 * filter that makes the reader doubt the page rather than doubt the filter.
 */
function Scopes({ report, params }: { report: AttentionReport; params: AttentionParams }) {
  const sorts: { key: AttentionSort; label: string }[] = [
    { key: "dwell", label: "Longest held" },
    { key: "visits", label: "Most visits" },
    { key: "friction", label: "Most dead clicks" },
  ];

  return (
    <div className="mb-6 flex flex-col gap-3">
      <ScopeRow label="Section">
        <ScopeLink params={params} override={{ section: "" }} isActive={!params.section}>
          All
        </ScopeLink>
        {report.sections.map((section) => (
          <ScopeLink
            key={section}
            params={params}
            override={{ section }}
            isActive={params.section === section}
          >
            {humanise(section)}
          </ScopeLink>
        ))}
      </ScopeRow>

      {report.routes.length > 1 && (
        <ScopeRow label="Page">
          <ScopeLink params={params} override={{ route: "" }} isActive={!params.route}>
            All
          </ScopeLink>
          {report.routes.map((route) => (
            <ScopeLink
              key={route}
              params={params}
              override={{ route }}
              isActive={params.route === route}
            >
              {routeLabel(route)}
            </ScopeLink>
          ))}
        </ScopeRow>
      )}

      <ScopeRow label="Sort">
        {sorts.map((sort) => (
          <ScopeLink
            key={sort.key}
            params={params}
            override={{ sort: sort.key }}
            isActive={params.sort === sort.key}
          >
            {sort.label}
          </ScopeLink>
        ))}
      </ScopeRow>
    </div>
  );
}

function ScopeRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="w-14 shrink-0 text-[10px] tracking-[0.12em] text-muted/60 uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function ScopeLink({
  params,
  override,
  isActive,
  children,
}: {
  params: AttentionParams;
  override: Partial<AttentionParams>;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={buildAttentionHref(params, override)}
      aria-current={isActive ? "page" : undefined}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
        isActive
          ? "border-accent/40 bg-accent/10 text-fg"
          : "border-border text-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function TargetTable({
  report,
  params,
  phrase,
}: {
  report: AttentionReport;
  params: AttentionParams;
  phrase: string;
}) {
  if (report.rows.length === 0) {
    return (
      <p className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
        Nothing matched that scope {phrase}. Widen the section or the page above.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm text-fg">Elements, {phrase}</h2>
        <p className="text-[11px] text-muted">
          Median dwell per element. A greyed name is one the site has not labelled yet.
        </p>
      </div>

      {report.unplacedRows > 0 && (
        <p className="rounded-sm border border-border bg-card px-3 py-2 text-[11px] text-muted">
          ⚠ {report.unplacedRows} older {report.unplacedRows === 1 ? "row" : "rows"} have no section.
          Cursor events only began carrying one in schema v3 — they are older than the question, not
          wrong.
        </p>
      )}

      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">
              <th className="px-4 py-2.5 text-left font-normal">Element</th>
              <th className="px-4 py-2.5 text-left font-normal">Where</th>
              <th className="px-4 py-2.5 text-right font-normal">Visits</th>
              <th className="px-4 py-2.5 text-right font-normal">Held</th>
              <th className="px-4 py-2.5 text-right font-normal">Clicks</th>
              <th className="px-4 py-2.5 text-right font-normal">Dead</th>
              <th className="px-4 py-2.5 text-right font-normal">Rage</th>
            </tr>
          </thead>
          {/* ⚠ colSpan must match the seven headers above, or the toggle row narrows the table. */}
          <ExpandableRows as="tbody" colSpan={7} label="elements">
            {report.rows.map((row) => (
              <TargetRow key={rowKey(row)} row={row} params={params} />
            ))}
          </ExpandableRows>
        </table>
      </div>
    </section>
  );
}

/** ⚠ The stop is part of the identity, not decoration — one target yields a row PER stop. */
function rowKey(row: AttentionRowDetail): string {
  return [row.target, row.section, row.carousel, row.stopIndex].join("\u0000");
}

function TargetRow({ row, params }: { row: AttentionRowDetail; params: AttentionParams }) {
  const { name, kind, isAuthored } = describeTargetLabel(row.target);

  return (
    <tr className="border-t border-border">
      <td className="max-w-[18rem] px-4 py-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={`truncate ${isAuthored ? "text-fg" : "text-muted"}`}>{name}</span>
          {kind && <span className="shrink-0 text-[10px] text-muted/60">{kind}</span>}
        </span>
      </td>

      <td className="px-4 py-2">
        {row.section ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <Link
              href={buildAttentionHref(params, { section: row.section })}
              className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
            >
              {humanise(row.section)}
            </Link>
            {/* ⚠ The stop's NAME, resolved against today's ordering — see `attentionReport`. The
                index is shown beside it so a reader can tell a renamed craft from a reordered one. */}
            {row.stopName && (
              <span className="truncate text-xs text-fg">
                {row.stopName}
                <span className="ml-1 text-[10px] text-muted/60">
                  {String((row.stopIndex ?? 0) + 1).padStart(2, "0")}
                </span>
              </span>
            )}
            {!row.stopName && row.stopIndex !== null && (
              <span className="text-[10px] text-muted/60">
                stop {String(row.stopIndex + 1).padStart(2, "0")} · since removed
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted/60">Unknown</span>
        )}
      </td>

      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted">{row.sessions}</td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-fg">
        {row.medianDwellMs === null ? "—" : `${(row.medianDwellMs / 1000).toFixed(1)}s`}
      </td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted">{row.clicks}</td>
      <td className="px-4 py-2 text-right text-xs tabular-nums text-muted">{row.deadClicks}</td>
      <td
        className={`px-4 py-2 text-right text-xs tabular-nums ${
          row.rageClicks > 0 ? "text-fg" : "text-muted"
        }`}
      >
        {row.rageClicks}
      </td>
    </tr>
  );
}

/**
 * Which questions people actually open.
 *
 * ⚠ This needed NO site change — `faq:open` has carried `entryIndex` since the event existed, and
 * the panel owns the questions. It was only ever waiting to be asked.
 */
function FaqQuestions({ rows, phrase }: { rows: FaqQuestionRow[]; phrase: string }) {
  if (rows.length === 0) return null;

  const mostOpens = Math.max(...rows.map((row) => row.opens), 1);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm text-fg">Questions opened, {phrase}</h2>
        <p className="text-[11px] text-muted">
          Resolved against today&rsquo;s ordering — a reordered list re-points older rows.
        </p>
      </div>

      <ExpandableRows
        as="ul"
        className="flex flex-col gap-2.5 rounded-sm border border-border bg-card p-4"
        label="questions"
      >
        {rows.map((row) => (
          <li key={row.entryIndex} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[10px] tabular-nums text-muted/60">
                  {String(row.entryIndex + 1).padStart(2, "0")}
                </span>
                <span className={`truncate text-sm ${row.question ? "text-fg" : "text-muted/60"}`}>
                  {row.question ?? "Since deleted"}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                <span className="text-[11px] tabular-nums text-muted">{row.sessions} visits</span>
                <span className="w-8 text-right text-sm tabular-nums text-fg">{row.opens}</span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, (row.opens / mostOpens) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ExpandableRows>
    </section>
  );
}

import Link from "next/link";

import CursorHeatmap from "@/app/(panel)/user-activity/CursorHeatmap";
import ReportFilters from "@/app/(panel)/reports/ReportFilters";
import StatTile from "@/app/(panel)/reports/StatTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { buildActivityReport, type ActivityReport } from "@/lib/journey/activityReport";
import { PERIOD_PHRASES, resolveWindow } from "@/lib/leads/reportPeriod";
import { parseReportParams } from "@/lib/leads/reportsView";

/**
 * User activity — what visitors actually do on the website.
 *
 * ── ⚠ THIS IS NOT `/reports`, AND THE SPLIT IS THE WHOLE REASON IT IS A SEPARATE PAGE ───────────
 * `/reports` is about the PIPELINE: leads, stages, who is working them, what needs chasing. Every
 * figure there is about a person the studio is already talking to. This page is about people the
 * studio has never met and mostly never will — anonymous visits, a loader they may not survive, and
 * how far into the journey they got. Two audiences, two questions, and merging them would mean a
 * salesperson's daily view carrying traffic charts they cannot act on.
 *
 * ── ⚠ IT WILL READ ZERO UNTIL THE SITE'S COLLECTOR SHIPS ────────────────────────────────────────
 * The tables are real and this query is real; the thing that writes to them is a later phase. The
 * empty state below says which of the two situations you are in — "nothing has ever been recorded"
 * versus "nothing in this window" — because an analytics page showing zeros is otherwise
 * indistinguishable from a broken one, and that ambiguity is worst on the day you first open it.
 *
 * ⚠ Admin-only, and for the same reason `/inbox` and `/applications` are: `journey_events` has no
 * owner column, so `visibility.ts` has nothing to scope a salesperson's view by. The role is the
 * whole gate.
 */
export const dynamic = "force-dynamic";

export default async function UserActivityPage(props: PageProps<"/user-activity">) {
  await requireMember();
  const searchParams = await props.searchParams;
  const params = parseReportParams(searchParams);

  // One instant for every figure on the page — reading the clock inside each query would let a report
  // straddling midnight disagree with itself about what "today" means. Same rule as `/reports`.
  const now = new Date();
  const window = resolveWindow(params.period, now);

  const report = await buildActivityReport(window);
  const phrase = PERIOD_PHRASES[params.period];

  return (
    <>
      <PageHeader
        eyebrow="The website"
        title="User activity"
        description="How far visitors get, where they leave, and what holds them. Anonymous by default — most of these people never told us anything about themselves."
      />

      <ReportFilters params={params} people={[]} />

      {report.isEmpty ? (
        <EmptyActivity report={report} phrase={phrase} />
      ) : (
        <div className="flex flex-col gap-10">
          {/* Ordered by how load-bearing the question is. The loader funnel is why this page exists;
              friction is the only section anyone can act on today; the heatmaps are the most
              interesting and the least conclusive, so they close rather than lead. */}
          <Headline report={report} phrase={phrase} />
          <IntroFunnel report={report} />
          <SectionReach report={report} phrase={phrase} />
          <EnquiryFunnel report={report} phrase={phrase} />
          <Friction report={report} phrase={phrase} />
          <Attention report={report} phrase={phrase} />
          <Devices report={report} phrase={phrase} />
          <Heatmaps report={report} />
        </div>
      )}
    </>
  );
}

function Headline({ report, phrase }: { report: ActivityReport; phrase: string }) {
  const { headline } = report;

  return (
    <Section title="Headline" note={`Counted over ${phrase}. Every figure is visits, not page loads.`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visits" value={String(headline.visits)} hint="Reached the loader." />
        <StatTile
          label="Finished loading"
          value={String(headline.completedIntro)}
          tone={headline.completedIntro > 0 ? "good" : "neutral"}
          hint="Saw the site itself."
        />
        <StatTile
          label="Left during loading"
          value={String(headline.abandonedDuringIntro)}
          tone={headline.abandonedDuringIntro > 0 ? "bad" : "neutral"}
          hint="Closed the tab before it finished."
        />
        <StatTile
          label="Returning visitors"
          value={headline.knownVisitors === null ? "—" : String(headline.knownVisitors)}
          hint={
            headline.knownVisitors === null
              ? "Nobody has agreed to be recognised yet."
              : "People who agreed to be remembered."
          }
        />
      </div>
    </Section>
  );
}

/**
 * The reason this page exists.
 *
 * ⚠ Deliberately NOT a chart. Three numbers with their drop-off spelled out in words is more
 * readable than a funnel graphic at this size, and it does not invent precision — the middle step is
 * "got part-way", which is three coarse checkpoints rather than a continuous measure.
 */
function IntroFunnel({ report }: { report: ActivityReport }) {
  return (
    <Section
      title="The loader"
      note="The site holds about 8.8 MB behind its intro. This is how many people wait it out."
    >
      <Card>
        <ol className="flex flex-col">
          {report.introFunnel.map((step, index) => (
            <li
              key={step.label}
              className={`flex items-baseline justify-between gap-4 py-3 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="text-sm text-fg">{step.label}</span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="text-sm text-fg">{step.sessions}</span>
                <span className="w-14 text-right text-[11px] text-muted">
                  {step.shareOfStart === null ? "—" : `${Math.round(step.shareOfStart * 100)}%`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

function SectionReach({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.sectionReach.length === 0) {
    return (
      <Section title="How far they got" note={`Sections reached in ${phrase}.`}>
        <Card>
          <p className="py-2 text-xs text-muted">
            Nobody reached a section — everyone who arrived left during the loader.
          </p>
        </Card>
      </Section>
    );
  }

  const most = report.sectionReach[0]?.sessions ?? 1;

  return (
    <Section title="How far they got" note={`Sections reached in ${phrase}, by number of visits.`}>
      <Card>
        <ul className="flex flex-col gap-3">
          {report.sectionReach.map((row) => (
            <li key={row.section} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm capitalize text-fg">{row.section}</span>
                <span className="text-sm tabular-nums text-muted">{row.sessions}</span>
              </div>
              {/* A bar rather than a chart library: one measure, one dimension, no axis to label. */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(2, (row.sessions / most) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

function EnquiryFunnel({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.enquiryFunnel.every((step) => step.sessions === 0)) return null;

  return (
    <Section title="The contact form" note={`Visits that got as far as each step, in ${phrase}.`}>
      <Card>
        <ol className="flex flex-col">
          {report.enquiryFunnel.map((step, index) => (
            <li
              key={step.label}
              className={`flex items-baseline justify-between gap-4 py-3 ${index > 0 ? "border-t border-border" : ""}`}
            >
              <span className="text-sm text-fg">{step.label}</span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="text-sm text-fg">{step.sessions}</span>
                <span className="w-14 text-right text-[11px] text-muted">
                  {step.shareOfOpen === null ? "—" : `${Math.round(step.shareOfOpen * 100)}%`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

/**
 * ⚠ The only section here anyone can act on the same afternoon.
 *
 * A dead click is somebody expecting a control that is not there; a rage click is somebody who has
 * decided it is broken. Neither appears in any funnel — a visit with twelve dead clicks and a visit
 * with none look identical everywhere else on this page.
 */
function Friction({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.friction.length === 0) return null;

  return (
    <Section
      title="Clicks that went nowhere"
      note={`In ${phrase}. Dead = landed on nothing interactive. Rage = three or more in one spot, fast.`}
    >
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted/60">
              <th className="pb-2 text-left font-normal">What was clicked</th>
              <th className="pb-2 text-right font-normal">Dead</th>
              <th className="pb-2 text-right font-normal">Rage</th>
            </tr>
          </thead>
          <tbody>
            {report.friction.map((row) => (
              <tr key={row.target} className="border-t border-border">
                <td className="py-2 pr-4 font-mono text-xs text-fg">{row.target}</td>
                <td className="py-2 text-right tabular-nums text-muted">{row.deadClicks}</td>
                <td
                  className={`py-2 text-right tabular-nums ${row.rageClicks > 0 ? "text-fg" : "text-muted"}`}
                >
                  {row.rageClicks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

function Attention({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.attention.length === 0) return null;

  return (
    <Section title="What held the cursor" note={`Median dwell per element, in ${phrase}.`}>
      <Card>
        <ul className="flex flex-col gap-2.5">
          {report.attention.map((row) => (
            <li key={row.target} className="flex items-baseline justify-between gap-4">
              <span className="truncate font-mono text-xs text-fg">{row.target}</span>
              <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                <span className="text-xs text-muted">{row.sessions} visits</span>
                <span className="w-16 text-right text-sm text-fg">
                  {(row.medianDwellMs / 1000).toFixed(1)}s
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

/**
 * What machines actually load this site.
 *
 * ⚠ These are the allocator's own numbers, which the site computes on every load and, until now,
 * threw away. The quality budget has been tuned against one laptop; this is the first time anyone
 * can see the distribution it is really serving.
 */
function Devices({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.devices.length === 0) return null;

  const total = report.devices.reduce((sum, slice) => sum + slice.sessions, 0) || 1;

  return (
    <Section title="What they ran it on" note={`Device class, as the site's own allocator graded it, in ${phrase}.`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.devices.map((slice) => (
          <StatTile
            key={slice.tier}
            label={slice.tier}
            value={String(slice.sessions)}
            hint={`${Math.round((slice.sessions / total) * 100)}% of visits`}
          />
        ))}
      </div>
    </Section>
  );
}

function Heatmaps({ report }: { report: ActivityReport }) {
  if (report.heatmaps.length === 0) return null;

  return (
    <Section
      title="Where the cursor rested"
      note="Per section, normalised to its own busiest spot — so two heatmaps cannot be compared for volume. Desktop only; a phone has no cursor."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {report.heatmaps.map((heatmap) => (
          <Card key={heatmap.section}>
            <CursorHeatmap heatmap={heatmap} />
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="eyebrow">{title}</h2>
        <p className="mt-1 text-[11px] text-muted/60">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sm border border-border bg-card p-4">{children}</div>;
}

/**
 * ⚠ TWO DIFFERENT EMPTY STATES, AND TELLING THEM APART IS THE POINT.
 *
 * "Nothing has ever been recorded" means the website is not sending yet — a build problem, or simply
 * a phase that has not shipped. "Nothing in this window" means it is sending and the window is quiet.
 * A single "no data" message for both would send someone to debug a system that is working, or leave
 * them waiting patiently for a system that was never switched on.
 */
function EmptyActivity({ report, phrase }: { report: ActivityReport; phrase: string }) {
  const hasNeverRecorded = report.totalEventsEver === 0;

  return (
    <div className="rounded-sm border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-fg">
        {hasNeverRecorded ? "Nothing has been recorded yet." : `Nothing recorded in ${phrase}.`}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
        {hasNeverRecorded
          ? "The tables are here and this page is wired to them, but the website is not sending anything yet. That part ships separately — until it does, this stays at zero and it is not a fault."
          : "The website is sending, there was simply no traffic in this window. Try a longer period."}
      </p>
      {!hasNeverRecorded && (
        <p className="mt-4 text-[11px] text-muted/60">
          {report.totalEventsEver} events recorded in total, all time.
        </p>
      )}
    </div>
  );
}

import CursorHeatmap from "@/app/(panel)/user-activity/CursorHeatmap";
import ActivityFilters from "@/app/(panel)/user-activity/ActivityFilters";
import VisitsTrend from "@/app/(panel)/user-activity/VisitsTrend";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { buildActivityReport, type ActivityReport } from "@/lib/journey/activityReport";
import {
  ACTIVITY_PERIOD_PHRASES,
  resolveActivityWindow,
  type ActivityWindow,
} from "@/lib/journey/activityWindow";
import { parseActivityParams } from "@/lib/journey/activityView";
import {
  humanise,
  describeTargetLabel,
  routeLabel,
  deviceTierLabel,
} from "@/lib/journey/sectionLabel";

/**
 * User activity — what visitors actually do on the website.
 *
 * ── ⚠ THIS IS NOT `/reports`, AND THE SPLIT IS THE WHOLE REASON IT IS A SEPARATE PAGE ───────────
 * `/reports` is about the PIPELINE: leads, stages, who is working them, what needs chasing. Every
 * figure there is about a person the studio is already talking to. This page is about people the
 * studio has never met and mostly never will — anonymous visits, a loader they may not survive, and
 * how far into the journey they got.
 *
 * ── ⚠ THE PAGE HAS A SHAPE, AND IT IS NOT "EIGHT EQUAL SECTIONS" ───────────────────────────────
 * It used to be, and it was unreadable for exactly that reason: every question was set at the same
 * size with a paragraph of explanation under it, so nothing said which one to read first and the
 * whole page had to be worked through to get one number out of it. It now reads top to bottom as one
 * argument:
 *
 *   1 · THE ANSWER      one figure — did visitors get past the loader — with its counts beside it
 *   2 · WHEN            the shape of arrival over the window
 *   3 · HOW FAR         where they got to once inside
 *   4 · THE DETAIL      everything else, demoted into a grid of small cards
 *   5 · THE PICTURES    heatmaps, which are the most interesting and the least conclusive
 *
 * ⚠ The explanatory prose is deliberately gone from most cards. What survives is the caveat a reader
 * would MISREAD the number without — the heatmap's per-section normalisation, the dead/rage
 * definitions — and nothing that merely restates the title in a longer form.
 *
 * ⚠ Admin-only, and for the same reason `/inbox` and `/applications` are: `journey_events` has no
 * owner column, so `visibility.ts` has nothing to scope a salesperson's view by. The role is the
 * whole gate.
 */
export const dynamic = "force-dynamic";

export default async function UserActivityPage(props: PageProps<"/user-activity">) {
  await requireMember();
  const searchParams = await props.searchParams;
  const params = parseActivityParams(searchParams);

  // One instant for every figure on the page — reading the clock inside each query would let a report
  // straddling midnight disagree with itself about what "today" means. Same rule as `/reports`.
  const now = new Date();
  const window = resolveActivityWindow(params.period, now, params.from, params.to);

  const report = await buildActivityReport(window);
  const phrase = ACTIVITY_PERIOD_PHRASES[window.key];

  return (
    <>
      <PageHeader
        eyebrow="The website"
        title="User activity"
        description="How far visitors get, where they leave, and what holds them. Anonymous by default."
      />

      <ActivityFilters params={params} />

      {report.isEmpty ? (
        <EmptyActivity report={report} phrase={phrase} />
      ) : (
        <div className="flex flex-col gap-10">
          <Answer report={report} phrase={phrase} />
          <Trend report={report} phrase={phrase} bucket={window.bucket} />
          <SectionReach report={report} phrase={phrase} />
          <Detail report={report} phrase={phrase} />
          <Heatmaps report={report} />
        </div>
      )}
    </>
  );
}

/**
 * The one thing this page is for.
 *
 * ⚠ A HERO FIGURE AND A METER, not a fourth equal stat tile. The site holds ~8.8 MB behind an intro
 * and the only question that matters is how many people wait it out — a ratio against a limit, which
 * is what a meter is for. The three counts underneath are the evidence for it, so they are set
 * smaller and to one side rather than competing with it.
 */
function Answer({ report, phrase }: { report: ActivityReport; phrase: string }) {
  const { headline } = report;
  const percent = headline.completionRate === null ? null : Math.round(headline.completionRate * 100);

  return (
    <section className="rounded-sm border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
        <div className="lg:w-72 lg:shrink-0">
          <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Got past the loader</p>

          <p className="mt-1 font-display text-5xl font-extrabold tracking-tight text-fg">
            {percent === null ? "—" : `${percent}%`}
          </p>

          {/* The meter is the same measure as the figure, drawn. It is a track rather than a chart
              because there is one value and no axis worth labelling. */}
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border"
            role="img"
            aria-label={
              percent === null
                ? "No visits to measure"
                : `${percent}% of visits finished loading`
            }
          >
            <div className="h-full rounded-full bg-accent" style={{ width: `${percent ?? 0}%` }} />
          </div>

          <p className="mt-2 text-[11px] text-muted">
            {headline.completedIntro} of {headline.visits} visits, {phrase}.
          </p>
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:border-l lg:border-border lg:pl-10">
          <Figure label="Visits" value={String(headline.visits)} note="Reached the loader." />
          <Figure
            label="Finished loading"
            value={String(headline.completedIntro)}
            note="Saw the site itself."
          />
          <Figure
            label="Left while loading"
            value={String(headline.abandonedDuringIntro)}
            note="Closed the tab first."
            tone={headline.abandonedDuringIntro > 0 ? "bad" : "neutral"}
          />
          <Figure
            label="Returning"
            value={headline.knownVisitors === null ? "—" : String(headline.knownVisitors)}
            note={headline.knownVisitors === null ? "Nobody opted in." : "Agreed to be remembered."}
          />
        </dl>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "bad";
}) {
  return (
    <div>
      <dt className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd
        className={`mt-1 font-display text-2xl font-extrabold tracking-tight ${
          tone === "bad" ? "text-danger" : "text-fg"
        }`}
      >
        {value}
      </dd>
      <p className="mt-0.5 text-[11px] text-muted/60">{note}</p>
    </div>
  );
}

function Trend({
  report,
  phrase,
  bucket,
}: {
  report: ActivityReport;
  phrase: string;
  bucket: ActivityWindow["bucket"];
}) {
  return (
    // ⚠ The bucket is stated, not implied. A reader who assumes days on a window that is bucketed by
    // week reads every point as seven times the traffic it represents.
    <Section title="When they came" note={`Visits per ${bucket}, across ${phrase}.`}>
      <Card>
        <VisitsTrend points={report.trend} />
      </Card>
    </Section>
  );
}

/**
 * ⚠ THIS SECTION WAS READING "everyone left at the hero" UNTIL THE SITE'S SECTION TRACKING WAS FIXED.
 * `SECTION_ARRIVE_EVENT` on the site only ever fired on a navbar jump, so a visitor who scrolled the
 * whole journey registered nothing. It is driven by `CURRENT_SECTION_EVENT` now, which fires however
 * the visitor moves — see that module's header.
 */
function SectionReach({ report, phrase }: { report: ActivityReport; phrase: string }) {
  if (report.sectionReach.length === 0) {
    return (
      <Section title="How far they got" note={`Sections reached, ${phrase}.`}>
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
    <Section title="How far they got" note={`Sections reached, ${phrase}, by number of visits.`}>
      <Card>
        <ul className="flex flex-col gap-3">
          {report.sectionReach.map((row) => (
            <li key={row.section} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm text-fg">{humanise(row.section)}</span>
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

/**
 * Everything that is worth knowing but is not the headline.
 *
 * ⚠ A GRID, AND THAT IS THE POINT. Five questions at full width, stacked, was most of what made this
 * page feel long — each one demanded to be read in turn. Side by side and set small, they are
 * scannable, and a reader can drop into whichever one they came for. Each card hides itself when it
 * has nothing to say rather than drawing an empty frame.
 */
function Detail({ report, phrase }: { report: ActivityReport; phrase: string }) {
  const hasEnquiry = report.enquiryFunnel.some((step) => step.sessions > 0);
  const deviceTotal = report.devices.reduce((sum, slice) => sum + slice.sessions, 0) || 1;

  return (
    <Section title="The detail" note={`Everything else, ${phrase}.`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <MiniCard title="The loader, step by step" note="Where the wait is lost.">
          <StepList
            steps={report.introFunnel.map((step) => ({
              label: step.label,
              sessions: step.sessions,
              share: step.shareOfStart,
            }))}
          />
        </MiniCard>

        {hasEnquiry && (
          <MiniCard title="The contact form" note="Visits reaching each step.">
            <StepList
              steps={report.enquiryFunnel.map((step) => ({
                label: step.label,
                sessions: step.sessions,
                share: step.shareOfOpen,
              }))}
            />
          </MiniCard>
        )}

        {report.friction.length > 0 && (
          <MiniCard
            title="Clicks that went nowhere"
            note="Dead = hit nothing interactive. Rage = three or more, fast, in one spot. A greyed name is one the site has not labelled yet."
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">
                  <th className="pb-2 text-left font-normal">Target</th>
                  <th className="pb-2 text-right font-normal">Dead</th>
                  <th className="pb-2 text-right font-normal">Rage</th>
                </tr>
              </thead>
              <tbody>
                {report.friction.map((row) => (
                  <tr key={row.target} className="border-t border-border">
                    <td className="py-1.5 pr-4 text-xs text-fg">
                      <TargetName target={row.target} />
                    </td>
                    <td className="py-1.5 text-right text-xs tabular-nums text-muted">
                      {row.deadClicks}
                    </td>
                    <td
                      className={`py-1.5 text-right text-xs tabular-nums ${
                        row.rageClicks > 0 ? "text-fg" : "text-muted"
                      }`}
                    >
                      {row.rageClicks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MiniCard>
        )}

        {report.attention.length > 0 && (
          <MiniCard title="What held the cursor" note="Median dwell per element.">
            <ul className="flex flex-col gap-2">
              {report.attention.map((row) => (
                <li key={row.target} className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-xs text-fg">
                    <TargetName target={row.target} />
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className="text-[11px] tabular-nums text-muted">{row.sessions} visits</span>
                    <span className="w-12 text-right text-xs tabular-nums text-fg">
                      {(row.medianDwellMs / 1000).toFixed(1)}s
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </MiniCard>
        )}

        {report.devices.length > 0 && (
          <MiniCard title="What they ran it on" note="The site's own allocator grade.">
            <ul className="flex flex-col gap-2.5">
              {report.devices.map((slice) => (
                <li key={slice.tier} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="text-sm text-fg">{deviceTierLabel(slice.tier).name}</span>
                      {deviceTierLabel(slice.tier).note && (
                        <span className="truncate text-[10px] text-muted">
                          {deviceTierLabel(slice.tier).note}
                        </span>
                      )}
                    </span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-[11px] tabular-nums text-muted">
                        {Math.round((slice.sessions / deviceTotal) * 100)}%
                      </span>
                      <span className="w-8 text-right text-sm tabular-nums text-fg">
                        {slice.sessions}
                      </span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, (slice.sessions / deviceTotal) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </MiniCard>
        )}
      </div>
    </Section>
  );
}

/** Two funnels, one shape — the label, the count, and the share of the step that started it. */
function StepList({
  steps,
}: {
  steps: { label: string; sessions: number; share: number | null }[];
}) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={`flex items-baseline justify-between gap-4 py-2 ${
            index > 0 ? "border-t border-border" : ""
          }`}
        >
          <span className="text-sm text-fg">{step.label}</span>
          <span className="flex items-baseline gap-3 tabular-nums">
            <span className="text-sm text-fg">{step.sessions}</span>
            <span className="w-11 text-right text-[11px] text-muted">
              {step.share === null ? "—" : `${Math.round(step.share * 100)}%`}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * ⚠ GROUPED BY ROUTE. Section keys only mean anything within their own page — `/about`'s stations are
 * its own, and `/` and `/lite` both have a `contact` — so a flat list of cards put two different
 * pages side by side with nothing saying which was which.
 */
function Heatmaps({ report }: { report: ActivityReport }) {
  if (report.heatmaps.length === 0) return null;

  const routes = [...new Set(report.heatmaps.map((heatmap) => heatmap.route))].sort();

  return (
    <Section
      title="Where the cursor rested"
      note="Each frame is one visitor's screen, thirds marked. Brighter is longer. Each is normalised to its OWN busiest spot, so two cannot be compared for volume — the visits beside each are what compare them. Desktop only; a phone has no cursor."
    >
      <div className="flex flex-col gap-6">
        {routes.map((route) => (
          <div key={route} className="flex flex-col gap-3">
            {/* ⚠ A NAME FIRST, THE PATH SECOND. This was the raw route, so the homepage's heading
                was a single "/" floating above a grid of cards — which reads as a stray character
                rather than as the thing every card under it belongs to. */}
            <h3 className="flex items-baseline gap-2">
              <span className="text-sm text-fg">{routeLabel(route)}</span>
              <span className="font-mono text-[11px] text-muted">{route}</span>
            </h3>
            <div className="grid gap-6 lg:grid-cols-2">
              {report.heatmaps
                .filter((heatmap) => heatmap.route === route)
                .map((heatmap) => (
                  <Card key={`${heatmap.route}${heatmap.section}`}>
                    <CursorHeatmap heatmap={heatmap} />
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * One `target` from the journey layer, as a name rather than a selector.
 *
 * ⚠ THE AUTHORED AND THE GUESSED ARE SET DIFFERENTLY, ON PURPOSE. A name the site supplied through
 * `[data-journey]` is a fact; a name this panel derived from `button.enquiry-cta` is a guess at what
 * a class meant, and the two should not read with equal authority. The guess is greyed and carries
 * its element type, which is also the prompt to go and label that element properly.
 */
function TargetName({ target }: { target: string }) {
  const { name, kind, isAuthored } = describeTargetLabel(target);

  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span className={`truncate ${isAuthored ? "text-fg" : "text-muted"}`}>{name}</span>
      {kind && <span className="shrink-0 text-[10px] text-muted/60">{kind}</span>}
    </span>
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

function MiniCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-sm border border-border bg-card p-4">
      <h3 className="text-sm text-fg">{title}</h3>
      <p className="mt-0.5 mb-3 text-[11px] text-muted/60">{note}</p>
      {children}
    </div>
  );
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
          ? "The tables are here and this page is wired to them, but nothing has arrived from the website. Check that the site is running against this panel and that the intake secret matches."
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

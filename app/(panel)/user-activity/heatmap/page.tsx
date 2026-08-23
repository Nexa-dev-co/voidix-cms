import Link from "next/link";

import HeatmapCanvas from "@/app/(panel)/user-activity/heatmap/HeatmapCanvas";
import ActivityFilters from "@/app/(panel)/user-activity/ActivityFilters";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExpandableRows } from "@/components/ui/ExpandableRows";
import { requireMember } from "@/lib/auth";
import {
  buildActivityReport,
  type SectionHeatmap,
  type ViewportShape,
} from "@/lib/journey/activityReport";
import {
  ACTIVITY_PERIOD_PHRASES,
  resolveActivityWindow,
} from "@/lib/journey/activityWindow";
import {
  ACTIVITY_PATH,
  HEATMAP_PATH,
  buildHeatmapHref,
  parseActivityParams,
} from "@/lib/journey/activityView";
import { findSectionLayout } from "@/lib/journey/sectionLayouts";
import { humanise, routeLabel } from "@/lib/journey/sectionLabel";

/**
 * One section's heatmap, full size.
 *
 * ── ⚠ IT REUSES `buildActivityReport` RATHER THAN QUERYING FOR ONE SECTION ─────────────────────
 * That looks wasteful and is not. `buildHeatmaps` already reads every grid in the window and folds
 * them into at most 576 numbers per group; a single-section query would read the same rows through
 * the same index and save one pass over a list of five. What it WOULD cost is a second definition of
 * how a grid becomes a picture — the normalisation, the 0.05 floor, the layout grouping — living in
 * two places and drifting. One report, two presentations.
 *
 * ⚠ The picture is selected by THREE things: route, section AND layout. A section can have one
 * heatmap per layout class and they are genuinely different data; dropping the layout from the
 * lookup would show whichever happened to sort first.
 */
export const dynamic = "force-dynamic";

export default async function HeatmapPage(props: PageProps<"/user-activity/heatmap">) {
  await requireMember();
  const searchParams = await props.searchParams;
  const params = parseActivityParams(searchParams);

  const read = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const route = read(searchParams.route) || "/";
  const section = read(searchParams.section);
  const layoutKey = read(searchParams.layout);

  const now = new Date();
  const window = resolveActivityWindow(params.period, now, params.from, params.to);
  const phrase = ACTIVITY_PERIOD_PHRASES[window.key];
  const report = await buildActivityReport(window);

  const heatmap =
    report.heatmaps.find(
      (candidate) =>
        candidate.route === route &&
        candidate.section === section &&
        candidate.layout === layoutKey,
    ) ?? null;

  return (
    <>
      <PageHeader
        eyebrow={`${routeLabel(route)} · where the cursor rested`}
        title={section ? humanise(section) : "Heatmap"}
        description="Brighter is longer. The frame is one visitor's screen; the dashed boxes are roughly where the section's furniture sits."
        action={
          <Link
            href={ACTIVITY_PATH}
            className="shrink-0 text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
          >
            ← User activity
          </Link>
        }
      />

      {/* ⚠ Told where it lives, or a period change would drop the reader back on the overview and
          lose which section they were looking at. See `ActivityFilters`. */}
      <ActivityFilters
        params={params}
        basePath={HEATMAP_PATH}
        extraQuery={{ route, section, layout: layoutKey }}
      />

      {heatmap === null ? (
        <Missing report={report} phrase={phrase} />
      ) : (
        <Detail heatmap={heatmap} phrase={phrase} />
      )}
    </>
  );
}

function Detail({ heatmap, phrase }: { heatmap: SectionHeatmap; phrase: string }) {
  const layout = findSectionLayout(heatmap.section, heatmap.route, heatmap.layout);
  const visitWord = heatmap.sessions === 1 ? "visit" : "visits";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <HeatmapCanvas heatmap={heatmap} layout={layout} />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
        <Figure label="Visits" value={`${heatmap.sessions} ${visitWord}`} note={phrase} />
        {/* ⚠ "Active", not "watched". Until v5 this counted every second the section was open —
            measured at 95 % idle on real data, because a tab left open kept the clock running and
            the loader's whole wait landed on the hero. It now counts only ticks where a pointer was
            present and the tab was visible. */}
        <Figure
          label="Cursor active"
          value={formatDuration(heatmap.observedMs)}
          note="Pointer present and tab visible, summed across every visit"
        />
        <Figure
          label="Samples"
          value={heatmap.samples.toLocaleString("en-GB")}
          note="Cursor positions behind this picture"
        />
        <StillnessNote heatmap={heatmap} />
        <LayoutNote heatmap={heatmap} hasLayout={layout !== null} />
        <ScreenSizes viewports={heatmap.viewports} />
      </aside>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">{label}</p>
      <p className="mt-1 text-lg tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{note}</p>
    </div>
  );
}

/**
 * ⚠ "THE SECTIONS ALL LOOK THE SAME" IS USUALLY THIS, AND IT IS NOT A BUG.
 *
 * A wheel scrolls the page without moving the pointer, so a visitor who reads by scrolling leaves the
 * cursor parked wherever it happened to be — and every section they pass through gets a hot spot in
 * the same square. Measured on a real session: a `work` summary with **264 samples in ONE cell**, and
 * a `faq` one with 88 in one. Those are not heatmaps, they are a stationary mouse, and drawing them
 * beside a genuinely explored section invites exactly the wrong conclusion.
 *
 * The overlap between sections was separately measured at 0–20 %, so the data is NOT shared — it just
 * looks alike when nobody moved. Saying so is cheaper than letting a reader discover it.
 */
function StillnessNote({ heatmap }: { heatmap: SectionHeatmap }) {
  if (heatmap.cells.length === 0 || heatmap.samples === 0) return null;

  // With everything normalised to the hottest cell, a picture made of one or two warm squares is a
  // parked pointer however many samples it holds.
  const isParked = heatmap.cells.length <= 2 && heatmap.samples >= 50;
  if (!isParked && heatmap.cells.length > 4) return null;

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">Movement</p>
      <p className="mt-1 text-sm tabular-nums text-fg">
        {heatmap.cells.length} {heatmap.cells.length === 1 ? "square" : "squares"}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        {isParked
          ? "The pointer barely moved — this is a parked mouse during wheel scrolling, not a map of attention. Sections read this way often look alike without sharing any data."
          : "Very few squares were touched, so read the shape loosely."}
      </p>
    </div>
  );
}

/**
 * ⚠ The honest note about what frame this is. A narrow heatmap gets NO schematic — there is no
 * capture of the narrow layout to measure one from, and an invented one would look authoritative.
 */
function LayoutNote({
  heatmap,
  hasLayout,
}: {
  heatmap: SectionHeatmap;
  hasLayout: boolean;
}) {
  const body =
    heatmap.layout === "wide" && hasLayout
      ? heatmap.isLayoutInferred
        ? "The wide layout, RECOVERED from this session's device profile rather than measured — the grid itself predates layout capture. Read the frame as approximate."
        : "Gathered on the wide layout. The mimic is measured from a 16:9 capture, so regions are approximate on any other shape."
      : heatmap.layout === "narrow"
        ? "Gathered on the narrow layout, below 51.25em. No mimic is drawn — the site renders something genuinely different there and nobody has measured it yet."
        : "Recorded before the viewport was captured, and this session left no device profile to recover one from. No mimic can be drawn.";

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">The frame</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/**
 * The actual screens this picture came from.
 *
 * ⚠ THIS IS WHY THE FRAME IS THE SHAPE IT IS. The mimic is drawn at the first row's aspect ratio —
 * the screen most of these cells were gathered on — rather than at a hard-coded 16:9. A reader whose
 * visitors are all on 16:10 laptops was previously shown every region a few percent out of place,
 * in the one direction nobody would think to check.
 *
 * ⚠ The heatmap itself is NOT split by size. Cells are fractions of each visitor's own viewport, so
 * they compose across shapes; only the reference frame has to pick one. Splitting would shatter the
 * data into a card per monitor.
 */
function ScreenSizes({ viewports }: { viewports: ViewportShape[] }) {
  if (viewports.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-3">
        <p className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">Screens</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Not recorded, and no device profile on these sessions to recover one from — so the frame
          falls back to 16:9.
        </p>
      </div>
    );
  }

  const totalGrids = viewports.reduce((sum, shape) => sum + shape.grids, 0);

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <p className="text-[10px] tracking-[0.12em] text-muted/60 uppercase">Screens</p>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {viewports.map((shape, index) => (
          <li key={`${shape.width}x${shape.height}`} className="flex items-baseline justify-between gap-3">
            <span className="flex items-baseline gap-1.5">
              <span className="text-xs tabular-nums text-fg">
                {shape.width}×{shape.height}
              </span>
              <span className="text-[10px] text-muted/60">
                {(shape.width / shape.height).toFixed(2)}
                {/* ⚠ Only the first one shapes the frame — say so, or the others look ignored. */}
                {index === 0 ? " · frame" : ""}
              </span>
            </span>
            <span className="text-[11px] tabular-nums text-muted">
              {Math.round((shape.grids / totalGrids) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Missing({
  report,
  phrase,
}: {
  report: { heatmaps: SectionHeatmap[] };
  phrase: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-sm border border-border bg-card p-6 text-sm text-muted">
        No heatmap for that section {phrase}. It may have been gathered in a different period, or on
        a different layout.
      </p>

      {report.heatmaps.length > 0 && (
        <ExpandableRows as="div" className="flex flex-wrap gap-2" label="heatmaps">
          {report.heatmaps.map((candidate) => (
            <Link
              key={`${candidate.route} ${candidate.section} ${candidate.layout}`}
              href={buildHeatmapHref(candidate.route, candidate.section, candidate.layout)}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted hover:border-border-strong hover:text-fg"
            >
              {routeLabel(candidate.route)} · {humanise(candidate.section)}
            </Link>
          ))}
        </ExpandableRows>
      )}
    </div>
  );
}

/** Mirrors `CursorHeatmap.formatDuration` — seconds alone stop reading about a minute in. */
function formatDuration(totalMs: number): string {
  const seconds = Math.round(totalMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

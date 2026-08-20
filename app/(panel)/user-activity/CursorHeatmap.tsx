import { humanise } from "@/lib/journey/sectionLabel";
import { CURSOR_GRID_COLUMNS, CURSOR_GRID_ROWS } from "@/lib/journey/intakeSchema";
import type { SectionHeatmap } from "@/lib/journey/activityReport";

/**
 * Where the cursor rested in one section.
 *
 * ── ⚠ A CSS GRID, NOT A CANVAS AND NOT A CHART LIBRARY ─────────────────────────────────────────
 * It is 576 divs with a colour each. A canvas would need a client component, a ref, a resize
 * observer and a redraw; `recharts` has no mark for this at all. This renders on the server, ships no
 * JavaScript, and is legible at any width because the aspect ratio is fixed rather than measured.
 *
 * ── ⚠ THE FRAME IS 16:9 AND THE DATA IS NOT NECESSARILY ────────────────────────────────────────
 * Cells were recorded as a fraction of each visitor's own viewport, so a 21:9 monitor and a 4:3
 * laptop both fill the same 32×18 grid. That is the point — it makes visits comparable — but it means
 * this picture is a composite of differently-shaped screens rather than a screenshot of any one of
 * them. Read it as "which region of the frame", never as pixel positions.
 *
 * ── ⚠ WHAT WAS WRONG WITH THE FIRST VERSION, because four of the five faults look like taste ────
 * It drew the right data and could not be read. In order of how much each one cost:
 *
 *   1 · NO SPATIAL REFERENCE. A blob in an empty rectangle has no location — a reader cannot say
 *       whether it sits centre, left or high without something to measure it against. Thirds, a
 *       centre mark and corner ticks cost nothing and turn the picture into a map.
 *   2 · NO SENSE OF WEIGHT. `intensity` is normalised per section, so one visit and four hundred are
 *       drawn with identical confidence and the reader has no way to tell them apart. The counts are
 *       now stated, and below CONFIDENT_SESSIONS the picture says so itself.
 *   3 · AN INVISIBLE FLOOR. Alpha ran 0 to 0.85 straight off intensity, so a cell holding one sample
 *       against a hottest of twenty painted at 4 per cent over black — indistinguishable from empty.
 *       Anything with data now starts at FLOOR_ALPHA.
 *   4 · HARD CELLS. 576 sharp squares read as a scatter plot of noise rather than as heat, and they
 *       imply the 32×18 boundary is meaningful when it is an arbitrary quantisation. One blur pass
 *       makes it a field.
 *   5 · NO LEGEND. Nothing said what orange meant, or that it means something different in the card
 *       next to it.
 */

/**
 * ⚠ A TEMPERATURE RAMP, WHICH IS NOT THE "RAINBOW SCALE" THIS COMPONENT USED TO REFUSE.
 *
 * The old note argued a hue ramp implies categories where there is only one measure — true of a
 * rainbow, and not true here. Luminance climbs monotonically across these three stops and the hue
 * rotates only 14° to 36°, which is the same construction, and the same reasoning, as the site's own
 * heat scale: hue moves with luminance because that is what hot matter does.
 *
 * ⚠ The low stop is a VISIBLE ember, not a near-black. It is the first thing a reader sees of a
 * quiet cell, and the previous version's fault was that a quiet cell was not visible at all.
 */
interface RampStop {
  /** Where this stop sits on the 0..1 intensity scale. */
  at: number;
  color: readonly [number, number, number];
}

const RAMP: readonly RampStop[] = [
  { at: 0, color: [143, 61, 0] },
  { at: 0.55, color: [255, 138, 26] },
  { at: 1, color: [255, 224, 176] },
];

/** Any cell with data must be visible against the page. Below this the picture lies by omission. */
const FLOOR_ALPHA = 0.55;

/**
 * ⚠ In container-query units so it tracks the card's width. A cell is 100/32 = 3.125cqw across, so
 * this is a little over half a cell — enough to read as a field, not enough to move a blob out of
 * the third it was measured in.
 */
const BLUR_CQW = 1.7;

/**
 * Below this many visits the shape is one or two people's mice and nothing more.
 *
 * ⚠ It marks rather than hides. Hiding would answer "why is there nothing here" with silence, and a
 * studio watching its first visitors arrive has every reason to want to see them — it just must not
 * be invited to draw a conclusion from four cursors.
 */
const CONFIDENT_SESSIONS = 8;

function rampColor(intensity: number): string {
  const clamped = Math.min(Math.max(intensity, 0), 1);

  let lower = RAMP[0];
  let upper = RAMP[RAMP.length - 1];
  for (let index = 0; index < RAMP.length - 1; index += 1) {
    if (clamped >= RAMP[index].at && clamped <= RAMP[index + 1].at) {
      lower = RAMP[index];
      upper = RAMP[index + 1];
      break;
    }
  }

  const span = upper.at - lower.at;
  const position = span === 0 ? 0 : (clamped - lower.at) / span;
  const channel = (index: number) =>
    Math.round(lower.color[index] + (upper.color[index] - lower.color[index]) * position);

  const alpha = FLOOR_ALPHA + (1 - FLOOR_ALPHA) * clamped;
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)} / ${alpha.toFixed(3)})`;
}

/** 184000 becomes "3m 4s". Seconds alone stop being readable about a minute in. */
function formatDuration(totalMs: number): string {
  const seconds = Math.round(totalMs / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function CursorHeatmap({ heatmap }: { heatmap: SectionHeatmap }) {
  // Sparse in, dense out: the grid needs every cell to lay out, the payload only carried the warm ones.
  const intensities = new Map(heatmap.cells.map((cell) => [cell.cell, cell.intensity]));
  const cellCount = CURSOR_GRID_COLUMNS * CURSOR_GRID_ROWS;
  const isProvisional = heatmap.sessions < CONFIDENT_SESSIONS;
  const visitWord = heatmap.sessions === 1 ? "visit" : "visits";

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-4">
        {/* ⚠ Humanised, not `capitalize`. A document route's section key is a DOM id — `the-studio`
            — and a CSS transform cannot turn a hyphen into a space, so the raw id was being shown. */}
        <span className="text-sm text-fg">{humanise(heatmap.section)}</span>
        <span className="text-[11px] tabular-nums text-muted">
          {heatmap.sessions} {visitWord} · {formatDuration(heatmap.observedMs)} watched
        </span>
      </figcaption>

      <div
        className="relative w-full overflow-hidden rounded-sm border border-border bg-bg"
        style={{
          // The blur below is sized in `cqw`, which needs an inline-size container to resolve against.
          containerType: "inline-size",
          aspectRatio: `${CURSOR_GRID_COLUMNS} / ${CURSOR_GRID_ROWS}`,
        }}
        role="img"
        aria-label={
          `Cursor heatmap for ${humanise(heatmap.section)}, from ${heatmap.sessions} ${visitWord}. ` +
          "Brighter areas are where the cursor spent longer. " +
          "Normalised to this section's own busiest spot."
        }
      >
        {/* ⚠ Its OWN layer, because the blur must not touch the reference marks over it — a blurred
            grid line is just a smear, and the marks are the thing that makes the blur readable. */}
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: `repeat(${CURSOR_GRID_COLUMNS}, 1fr)`,
            filter: `blur(${BLUR_CQW}cqw)`,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: cellCount }, (_, index) => {
            const intensity = intensities.get(index) ?? 0;
            return (
              <div
                key={index}
                style={intensity > 0 ? { backgroundColor: rampColor(intensity) } : undefined}
              />
            );
          })}
        </div>

        <ViewportReference />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Legend />
        {isProvisional && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
            Too few visits to read
          </span>
        )}
      </div>
    </figure>
  );
}

/**
 * The marks that give a blob somewhere to be.
 *
 * ⚠ THIRDS RATHER THAN A FULL GRID. The question a reader asks is "is that centre, or left, or
 * high" — thirds answer it in one glance, where a 32×18 lattice drawn over the data would compete
 * with it and answer nothing. The centre mark is separate because dead-centre is the one position
 * worth being able to name exactly, and the site's hero puts its wordmark there.
 */
function ViewportReference() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/3 w-px bg-fg/[0.06]" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-fg/[0.06]" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-fg/[0.06]" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-fg/[0.06]" />

      {/* Dead centre, drawn as a cross rather than a dot so it reads as a registration mark and not
          as a data point somebody might mistake for a reading. */}
      <div className="absolute top-1/2 left-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-fg/15" />
      <div className="absolute top-1/2 left-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-fg/15" />

      {/* Corner ticks: they say "this rectangle is a screen" faster than a caption can. */}
      <div className="absolute top-0 left-0 h-2 w-2 border-t border-l border-fg/20" />
      <div className="absolute top-0 right-0 h-2 w-2 border-t border-r border-fg/20" />
      <div className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-fg/20" />
      <div className="absolute right-0 bottom-0 h-2 w-2 border-r border-b border-fg/20" />
    </div>
  );
}

/** What the colour means — stated per card, because the scale is per card. */
function Legend() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted">Quiet</span>
      <div
        className="h-1.5 w-16 rounded-full"
        style={{
          backgroundImage: `linear-gradient(to right, ${rampColor(0)}, ${rampColor(0.55)}, ${rampColor(1)})`,
        }}
      />
      <span className="text-[10px] text-muted">Busiest here</span>
    </div>
  );
}

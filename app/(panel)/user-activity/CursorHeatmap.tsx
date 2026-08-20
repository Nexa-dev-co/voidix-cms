import { humanise } from "@/lib/journey/sectionLabel";
import { CURSOR_GRID_COLUMNS, CURSOR_GRID_ROWS } from "@/lib/journey/intakeSchema";
import type { SectionHeatmap } from "@/lib/journey/activityReport";

/**
 * Where the cursor rested in one section.
 *
 * ── ⚠ A CSS GRID, NOT A CANVAS AND NOT A CHART LIBRARY ─────────────────────────────────────────
 * It is 576 divs with an opacity each. A canvas would need a client component, a ref, a resize
 * observer and a redraw; `recharts` has no mark for this at all. This renders on the server, ships no
 * JavaScript, and is legible at any width because the aspect ratio is fixed rather than measured.
 *
 * ── ⚠ THE FRAME IS 16:9 AND THE DATA IS NOT NECESSARILY ────────────────────────────────────────
 * Cells were recorded as a fraction of each visitor's own viewport, so a 21:9 monitor and a 4:3
 * laptop both fill the same 32×18 grid. That is the point — it makes visits comparable — but it means
 * this picture is a composite of differently-shaped screens rather than a screenshot of any one of
 * them. Read it as "which region of the frame", never as pixel positions.
 *
 * ⚠ Intensity is normalised PER SECTION upstream, so the hottest cell here is always 1. Two heatmaps
 * side by side cannot be compared for volume — that is what the session count under each is for.
 */
export default function CursorHeatmap({ heatmap }: { heatmap: SectionHeatmap }) {
  // Sparse in, dense out: the grid needs every cell to lay out, the payload only carried the warm ones.
  const intensities = new Map(heatmap.cells.map((cell) => [cell.cell, cell.intensity]));
  const cellCount = CURSOR_GRID_COLUMNS * CURSOR_GRID_ROWS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        {/* ⚠ Humanised, not `capitalize`. A document route's section key is a DOM id — `the-studio`
            — and a CSS transform cannot turn a hyphen into a space, so the raw id was being shown. */}
        <span className="text-sm text-fg">{humanise(heatmap.section)}</span>
        <span className="text-[11px] tabular-nums text-muted">
          {heatmap.sessions} {heatmap.sessions === 1 ? "visit" : "visits"}
        </span>
      </div>

      <div
        className="grid w-full overflow-hidden rounded-sm border border-border bg-bg"
        style={{
          gridTemplateColumns: `repeat(${CURSOR_GRID_COLUMNS}, 1fr)`,
          aspectRatio: `${CURSOR_GRID_COLUMNS} / ${CURSOR_GRID_ROWS}`,
        }}
        role="img"
        aria-label={`Cursor heatmap for ${heatmap.section}, from ${heatmap.sessions} visits`}
      >
        {Array.from({ length: cellCount }, (_, index) => {
          const intensity = intensities.get(index) ?? 0;
          return (
            <div
              key={index}
              // ⚠ The accent at a varying alpha rather than a rainbow scale. A hue ramp implies
              // categories where there is only one measure, and it would be the only place in this
              // panel that invented a second colour system.
              style={
                intensity > 0
                  ? { backgroundColor: `rgb(var(--accent-rgb) / ${(intensity * 0.85).toFixed(3)})` }
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

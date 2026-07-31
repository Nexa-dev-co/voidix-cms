/**
 * Shared chart chrome, so four charts can't drift into four different grids.
 *
 * Every value is a token from `app/globals.css` — nothing here is a hex. The ramp is *ordinal*:
 * see the comment on `--chart-1` for what that means and why the order is load-bearing.
 */

/** Dim → bright. Position in the ramp encodes position in the pipeline, nothing else. */
const STAGE_RAMP = [
  "var(--chart-6)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
];

/** The one hue every nominal mark wears — source bars, the trend area. */
export const SERIES_COLOR = "var(--chart-3)";

export const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 };
export const GRID_STROKE = "var(--color-border)";
export const AXIS_STROKE = "var(--color-border-strong)";

/** Thin marks, per the mark spec — a bar is a measurement, not a block of colour. */
export const BAR_SIZE = 14;
/** 4px rounded data-end, anchored to the baseline: [topLeft, topRight, bottomRight, bottomLeft]. */
export const BAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0];

/**
 * One ramp step per stage, dimmest first.
 *
 * Sampled across the whole ramp rather than taking the first N, so four stages use its full
 * range instead of four adjacent steps that look identical. Further along the pipeline reads
 * brighter, which is the direction that matches "closer to won".
 */
export function stageRamp(total: number): string[] {
  if (total <= 0) {
    return [];
  }

  if (total === 1) {
    return [SERIES_COLOR];
  }

  return Array.from({ length: total }, (_, index) => {
    const position = index / (total - 1);

    return STAGE_RAMP[Math.round(position * (STAGE_RAMP.length - 1))];
  });
}

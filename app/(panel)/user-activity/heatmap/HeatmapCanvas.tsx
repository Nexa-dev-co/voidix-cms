"use client";

import { useState } from "react";

import { CURSOR_GRID_COLUMNS, CURSOR_GRID_ROWS } from "@/lib/journey/intakeSchema";
import type { SectionHeatmap } from "@/lib/journey/activityReport";
import type { SectionLayout } from "@/lib/journey/sectionLayouts";
import SiteMimic from "@/app/(panel)/user-activity/SiteMimic";

/**
 * The full-size heatmap, with a figure for every cell you point at.
 *
 * ── ⚠ THE ONE CLIENT COMPONENT IN THIS FEATURE, AND IT IS A DELIBERATE EXCEPTION ───────────────
 * `CursorHeatmap` is 576 server-rendered divs and ships no JavaScript, on the argument that a
 * dashboard card should not pay for interactivity nobody asked for. This is the other case: a page
 * somebody navigated to on purpose, showing one section, where "how hot is THAT square" is the
 * entire reason to be here. A `title` attribute would have kept it server-only and was rejected —
 * native tooltips take about a second to appear and cannot show a three-line readout.
 *
 * ⚠ ONE `onMouseLeave` ON THE CONTAINER, not 576 of them. Per-cell leave handlers fire on every
 * boundary crossing as the pointer travels, so the readout would flicker to empty between cells.
 */

/** Mirrors `CursorHeatmap`'s ramp exactly — see that file for why these three stops. */
const RAMP: readonly { at: number; color: readonly [number, number, number] }[] = [
  { at: 0, color: [143, 61, 0] },
  { at: 0.55, color: [255, 138, 26] },
  { at: 1, color: [255, 224, 176] },
];

const FLOOR_ALPHA = 0.55;
const BLUR_CQW = 1.2;

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

interface CellReading {
  index: number;
  intensity: number;
  /** 1-based, so the busiest cell reads "1st" rather than "0th". Null when the cell is empty. */
  rank: number | null;
  region: string | null;
}

export default function HeatmapCanvas({
  heatmap,
  layout,
}: {
  heatmap: SectionHeatmap;
  layout: SectionLayout | null;
}) {
  const [reading, setReading] = useState<CellReading | null>(null);

  // ⚠ The shape of the screen most of this data came from — see `viewports` on `SectionHeatmap`.
  // A forced 16:9 puts every region a few percent out for a reader whose visitors were on laptops.
  const dominant = heatmap.viewports[0];
  const frameAspect = dominant
    ? `${dominant.width} / ${dominant.height}`
    : `${CURSOR_GRID_COLUMNS} / ${CURSOR_GRID_ROWS}`;

  const intensities = new Map(heatmap.cells.map((cell) => [cell.cell, cell.intensity]));
  const cellCount = CURSOR_GRID_COLUMNS * CURSOR_GRID_ROWS;

  // Rank is computed once for the whole grid rather than per hover — 576 lookups against a prepared
  // map beats re-sorting the cell list on every pointer move.
  const ranks = new Map(
    [...heatmap.cells]
      .sort((left, right) => right.intensity - left.intensity)
      .map((cell, index) => [cell.cell, index + 1]),
  );

  const readCell = (index: number): CellReading => {
    const column = index % CURSOR_GRID_COLUMNS;
    const row = Math.floor(index / CURSOR_GRID_COLUMNS);
    // Centre of the cell, as a percentage — a region is a box in the same coordinate space.
    const x = ((column + 0.5) / CURSOR_GRID_COLUMNS) * 100;
    const y = ((row + 0.5) / CURSOR_GRID_ROWS) * 100;

    const region =
      layout?.regions.find(
        (candidate) =>
          x >= candidate.x &&
          x <= candidate.x + candidate.width &&
          y >= candidate.y &&
          y <= candidate.y + candidate.height,
      ) ?? null;

    return {
      index,
      intensity: intensities.get(index) ?? 0,
      rank: ranks.get(index) ?? null,
      region: region?.label ?? null,
    };
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative w-full overflow-hidden rounded-sm border border-border"
        style={{
          containerType: "inline-size",
          aspectRatio: frameAspect,
        }}
        onMouseLeave={() => setReading(null)}
      >
        {/* ⚠ FIRST, so the heat paints over it. `showText` is on here and off on the card: at full
            width the copy is legible and is what makes the frame recognisable as the real scene. */}
        {layout && <SiteMimic layout={layout} showText />}

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

        {/* ⚠ A SEPARATE, UNBLURRED GRID FOR POINTING AT. The painted layer above is blurred, and a
            blurred element's hit box is its original box — but it also sits under the reference
            marks, which would swallow the pointer. This layer is transparent, on top, and is the
            only thing that listens. */}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${CURSOR_GRID_COLUMNS}, 1fr)` }}
        >
          {Array.from({ length: cellCount }, (_, index) => (
            <div
              key={index}
              onMouseEnter={() => setReading(readCell(index))}
              className={
                reading?.index === index ? "outline outline-1 -outline-offset-1 outline-fg/40" : ""
              }
            />
          ))}
        </div>
      </div>

      <Readout reading={reading} heatmap={heatmap} />
    </div>
  );
}

function Readout({
  reading,
  heatmap,
}: {
  reading: CellReading | null;
  heatmap: SectionHeatmap;
}) {
  if (!reading) {
    return (
      <p className="text-[11px] text-muted">
        Point at the frame to read a square. Brightness is relative to this section&rsquo;s busiest
        spot, not to any other card.
      </p>
    );
  }

  if (reading.intensity === 0) {
    return (
      <p className="text-[11px] text-muted">
        {reading.region ? `${reading.region} — ` : ""}no cursor recorded here.
      </p>
    );
  }

  /**
   * ⚠ Intensity is a share of the BUSIEST CELL, not of total time — that is what normalising per
   * section means, and saying "8% of watched time" would be a different and wrong number.
   */
  const percent = Math.round(reading.intensity * 100);

  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
      {reading.region && <span className="text-fg">{reading.region}</span>}
      <span className="text-muted">
        <span className="tabular-nums text-fg">{percent}%</span> as busy as the hottest square
      </span>
      {reading.rank !== null && (
        <span className="text-muted">
          <span className="tabular-nums text-fg">{ordinal(reading.rank)}</span> busiest of{" "}
          <span className="tabular-nums">{heatmap.cells.length}</span>
        </span>
      )}
    </p>
  );
}

function ordinal(value: number): string {
  const remainderTen = value % 10;
  const remainderHundred = value % 100;

  if (remainderTen === 1 && remainderHundred !== 11) return `${value}st`;
  if (remainderTen === 2 && remainderHundred !== 12) return `${value}nd`;
  if (remainderTen === 3 && remainderHundred !== 13) return `${value}rd`;

  return `${value}th`;
}

function ViewportReference() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/3 w-px bg-fg/[0.06]" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-fg/[0.06]" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-fg/[0.06]" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-fg/[0.06]" />
      <div className="absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-fg/15" />
      <div className="absolute top-1/2 left-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-fg/15" />
      <div className="absolute top-0 left-0 h-2.5 w-2.5 border-t border-l border-fg/20" />
      <div className="absolute top-0 right-0 h-2.5 w-2.5 border-t border-r border-fg/20" />
      <div className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-fg/20" />
      <div className="absolute right-0 bottom-0 h-2.5 w-2.5 border-r border-b border-fg/20" />
    </div>
  );
}

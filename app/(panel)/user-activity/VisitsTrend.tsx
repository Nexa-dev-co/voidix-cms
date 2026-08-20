"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import ChartTooltip from "@/app/(panel)/reports/ChartTooltip";
import { AXIS_TICK, GRID_STROKE, SERIES_COLOR } from "@/app/(panel)/reports/chartTheme";
import type { VisitPoint } from "@/lib/journey/activityReport";

const CHART_HEIGHT = 180;
/** Enough ticks to read the shape, few enough that the labels never collide. */
const MAX_TICKS = 7;

/**
 * Visits arriving over the window.
 *
 * ── Why an area, and why only one series ───────────────────────────────────────────────────────
 * The question is the SHAPE of arrival over time, not the exact size of any one day — so an area,
 * not bars, which at daily resolution over ninety days is a comb. One series, so no legend: the
 * heading names it, and a legend box for a single line is furniture.
 *
 * ⚠ It deliberately does NOT also plot "finished loading" as a second line. Two series here would
 * invite reading the gap between them as the drop-off, which is a rate rather than a count and is
 * already stated as a rate at the top of the page. The trend answers "when did people come"; the
 * headline answers "how many got in".
 *
 * The exact numbers live in the fold-out table rather than printed on every point, which would be
 * unreadable and go unread — and it is what stops the tooltip being the only way to get a figure.
 */
export default function VisitsTrend({ points }: { points: VisitPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.visits, 0);

  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted">
        Pick a period with a start date to see visits over time.
      </p>
    );
  }

  if (total === 0) {
    return <p className="py-8 text-center text-xs text-muted">Nobody visited in this period.</p>;
  }

  // Thinning by index keeps the first and last labels, which are the two a reader looks for.
  const tickInterval = Math.max(0, Math.ceil(points.length / MAX_TICKS) - 1);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <defs>
            {/* The fill fades out downward so the area reads as weight under the line rather than a
                solid slab, which at this size would shout. */}
            <linearGradient id="visitsTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.28} />
              <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Horizontal only, and a solid hairline: vertical rules add nothing when the x-axis is
              already labelled, and dashes read as "threshold" when this is just a grid. */}
          <CartesianGrid stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            interval={tickInterval}
            minTickGap={8}
          />
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip cursor={{ stroke: "var(--color-border-strong)" }} content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="visits"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill="url(#visitsTrendFill)"
            isAnimationActive={false}
            // Points appear only on hover: a dot on every bucket is noise, but the hover target still
            // needs to be bigger than the line itself.
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] text-muted transition-colors duration-150 hover:text-fg">
          <span className="group-open:hidden">Show the numbers</span>
          <span className="hidden group-open:inline">Hide the numbers</span>
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-1 pr-4 font-normal">
                  When
                </th>
                <th scope="col" className="py-1 font-normal">
                  Visits
                </th>
              </tr>
            </thead>
            <tbody className="text-fg">
              {points.map((point) => (
                <tr key={point.label} className="border-t border-border">
                  <td className="py-1 pr-4">{point.label}</td>
                  <td className="py-1 tabular-nums">{point.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

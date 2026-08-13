"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import ChartTooltip from "@/app/(panel)/reports/ChartTooltip";
import { AXIS_TICK, GRID_STROKE, SERIES_COLOR } from "@/app/(panel)/reports/chartTheme";
import type { TimePoint } from "@/lib/leads/reports";

const CHART_HEIGHT = 200;
/** Enough ticks to read the shape, few enough that the labels never collide. */
const MAX_TICKS = 6;

/**
 * New leads arriving over the period.
 *
 * One series, so no legend — the heading names it. An area rather than bars because the question
 * is the shape of arrival over time, not the exact size of any one day, and rounded bars at
 * daily resolution over 90 days is a comb.
 *
 * The numbers are in the table below the chart rather than printed on every point, which would
 * be unreadable and go unread. That table is also what stops the tooltip being the only way to
 * get an exact figure.
 */
export default function LeadsTrend({ points }: { points: TimePoint[] }) {
  const total = points.reduce((sum, point) => sum + point.count, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-xs text-muted">No leads arrived in this period.</p>;
  }

  // Thinning by index keeps the first and last labels, which are the two a reader looks for.
  const tickInterval = Math.max(0, Math.ceil(points.length / MAX_TICKS) - 1);

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <defs>
            {/* The fill fades out downward so the area reads as weight under the line rather
                than a solid slab of cyan, which at this size would shout. */}
            <linearGradient id="leadsTrendFill" x1="0" y1="0" x2="0" y2="1">
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
            dataKey="count"
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill="url(#leadsTrendFill)"
            isAnimationActive={false}
            // Points appear only on hover: a dot on every bucket over 90 days is noise, but the
            // hover target still needs to be bigger than the line itself.
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
          <table className="w-full text-xs">
            <tbody>
              {points
                .filter((point) => point.count > 0)
                .map((point) => (
                  <tr key={point.at} className="border-b border-border/60 last:border-0">
                    <td className="py-1 text-muted">{point.label}</td>
                    <td className="py-1 text-right tabular-nums text-fg">{point.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

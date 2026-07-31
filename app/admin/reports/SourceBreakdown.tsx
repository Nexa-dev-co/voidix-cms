"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import ChartTooltip from "@/app/admin/reports/ChartTooltip";
import { AXIS_TICK, BAR_RADIUS, BAR_SIZE, SERIES_COLOR } from "@/app/admin/reports/chartTheme";
import type { SourceSlice } from "@/lib/leads/reports";

const ROW_HEIGHT = 34;
const LABEL_WIDTH = 96;

/**
 * Where the period's leads came from, and how many of them were won.
 *
 * Every bar is the *same* colour, deliberately. The three channels have no order — swapping
 * "By hand" and "Imported" changes nothing — so they are nominal, and colouring them differently
 * would spend the identity channel re-encoding what bar length already shows. Shading them by
 * value would be worse still.
 *
 * Wins are not a second series for the same reason a win is not a category: it means *good*, and
 * a status colour must never double as series 2. They live in the table underneath, which also
 * serves as this chart's readable-without-colour twin.
 */
export default function SourceBreakdown({ sources }: { sources: SourceSlice[] }) {
  const total = sources.reduce((sum, source) => sum + source.arrived, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted">No leads arrived in this period.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={sources.length * ROW_HEIGHT + 8}>
        <BarChart
          data={sources}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={LABEL_WIDTH}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={{ fill: "var(--color-surface-hover)" }} content={<ChartTooltip />} />
          <Bar
            dataKey="arrived"
            fill={SERIES_COLOR}
            barSize={BAR_SIZE}
            radius={BAR_RADIUS}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="arrived"
              position="right"
              offset={8}
              fill="var(--color-fg)"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-[0.12em] text-muted uppercase">
            <th scope="col" className="py-1.5 font-normal">
              Source
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Arrived
            </th>
            <th scope="col" className="py-1.5 text-right font-normal">
              Won
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.key} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 text-fg">{source.label}</td>
              <td className="py-1.5 text-right tabular-nums text-muted">{source.arrived}</td>
              <td className="py-1.5 text-right tabular-nums text-muted">
                {source.won > 0 ? <span className="text-success">{source.won}</span> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

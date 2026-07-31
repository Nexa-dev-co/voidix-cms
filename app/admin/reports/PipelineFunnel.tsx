"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartTooltip from "@/app/admin/reports/ChartTooltip";
import { AXIS_TICK, BAR_RADIUS, BAR_SIZE, stageRamp } from "@/app/admin/reports/chartTheme";
import type { StageSlice } from "@/lib/leads/reports";

/** Row height plus the gap between rows — the chart is sized from its data, not fixed. */
const ROW_HEIGHT = 34;
/** Stage names run long ("Proposal sent"), so the category axis gets real room. */
const LABEL_WIDTH = 96;

/**
 * Open leads by stage, right now.
 *
 * Horizontal because stage names are words, and a vertical bar chart would either rotate them or
 * truncate them. Colour is the *ordinal* ramp: it encodes how far along the pipeline a stage is,
 * which is the one thing bar length does not already say. Won and Lost are absent on purpose —
 * they mean good and bad rather than "further along", so they wear status colours in the tiles
 * above instead of pretending to be another rung of the same ladder.
 *
 * Counts are printed at the bar ends, so no value here depends on hovering.
 */
export default function PipelineFunnel({ stages }: { stages: StageSlice[] }) {
  if (stages.length === 0) {
    return <p className="py-8 text-center text-xs text-muted">No open stages in the pipeline.</p>;
  }

  const ramp = stageRamp(stages.length);
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted">
        Nothing sitting in the pipeline — every lead is won, lost or archived.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={stages.length * ROW_HEIGHT + 8}>
      <BarChart
        data={stages}
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
        <Tooltip
          cursor={{ fill: "var(--color-surface-hover)" }}
          content={<ChartTooltip />}
        />
        <Bar dataKey="count" barSize={BAR_SIZE} radius={BAR_RADIUS} isAnimationActive={false}>
          {stages.map((stage, index) => (
            <Cell key={stage.label} fill={ramp[index]} />
          ))}
          {/* Outside the bar, never inside it: the last stage of a funnel is often a bar a few
              pixels wide, and a label inside that is a clipped digit. Text wears an ink token
              rather than the bar's colour — the bar already carries the identity. */}
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            fill="var(--color-fg)"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

/**
 * The hover readout, shared by every chart on the page.
 *
 * Recharts' default tooltip is a white box — unreadable on this panel and not restyleable
 * without replacing it, which is what this is. Values wear text tokens, never the series colour:
 * the mark beside the label already carries identity, and colouring the number as well makes it
 * harder to read for no extra information.
 *
 * A tooltip never *gates* a value here. Bars are direct-labelled and the trend carries a table,
 * so this is a convenience for the point under the cursor, not the only way to read it.
 *
 * Props are declared locally and all optional rather than imported from Recharts, because its
 * `TooltipContentProps` marks internals as required — so `content={<ChartTooltip />}` would not
 * typecheck against a component that borrowed them.
 */
interface TooltipEntry {
  name?: string | number;
  value?: string | number;
}

export default function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-sm border border-border-strong bg-card px-2.5 py-1.5 shadow-lg">
      {label !== undefined && <p className="text-[11px] text-muted">{label}</p>}
      {payload.map((entry, index) => (
        <p key={index} className="text-xs tabular-nums text-fg">
          {entry.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

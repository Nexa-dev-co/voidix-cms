import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/classNames";

/**
 * One headline number, with how it moved against the previous period.
 *
 * A tile rather than a one-bar chart: a single value with a delta is not a chart, and drawing it
 * as one buries the number it exists to show.
 *
 * The value uses proportional figures, not `tabular-nums` — equal-width digits make a large
 * standalone number look loosely spaced. Tabular figures belong in columns that align.
 */
export default function StatTile({
  label,
  value,
  hint,
  delta,
  tone = "neutral",
  invertDelta = false,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Change against the previous equal window. Null when there is nothing to compare to. */
  delta?: { current: number; previous: number | null } | null;
  /** `good`/`bad` colour the value itself — only for figures that genuinely mean good or bad. */
  tone?: "neutral" | "good" | "bad";
  /** For figures where up is worse, such as leads lost. */
  invertDelta?: boolean;
}) {
  const movement = resolveMovement(delta, invertDelta);

  return (
    <div className="rounded-sm border border-border bg-card px-4 py-3.5">
      <p className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</p>

      <p
        className={cn(
          "mt-1.5 font-display text-2xl font-extrabold tracking-tight",
          tone === "good" && "text-success",
          tone === "bad" && "text-danger",
          tone === "neutral" && "text-fg",
        )}
      >
        {value}
      </p>

      {movement ? (
        <p className="mt-1 flex items-center gap-1 text-[11px]">
          {/* An arrow as well as a colour: the direction must not be carried by hue alone. */}
          <movement.Icon aria-hidden className={cn("size-3 shrink-0", movement.className)} />
          <span className={movement.className}>{movement.text}</span>
          <span className="text-muted/60">vs previous</span>
        </p>
      ) : (
        hint && <p className="mt-1 text-[11px] text-muted/60">{hint}</p>
      )}
    </div>
  );
}

function resolveMovement(
  delta: { current: number; previous: number | null } | null | undefined,
  invertDelta: boolean,
) {
  if (!delta || delta.previous === null) {
    return null;
  }

  const change = delta.current - delta.previous;

  if (change === 0) {
    return { Icon: Dash, className: "text-muted", text: "no change" };
  }

  const isUp = change > 0;
  const isGood = invertDelta ? !isUp : isUp;

  return {
    Icon: isUp ? ArrowUp : ArrowDown,
    className: isGood ? "text-success" : "text-danger",
    text: `${isUp ? "+" : ""}${change} from ${delta.previous}`,
  };
}

/** A flat rule for "no change" — an arrow pointing nowhere would still read as a direction. */
function Dash({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block h-px w-2.5 bg-current", className)} />
  );
}

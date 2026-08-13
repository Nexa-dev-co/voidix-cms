"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useActionState, useState } from "react";

import { saveColumnLayoutAction } from "@/app/(panel)/settings/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";

/** The serialisable slice of a resolved column the editor needs. */
export interface LayoutRow {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  isLocked: boolean;
  source: "builtin" | "custom";
}

/**
 * Composes the leads table: which columns show, and in what order.
 *
 * Reordering happens client-side and the whole list is submitted at once, rather than one
 * position per row through a server action. A per-row action would re-render between each move,
 * so dragging a column from last to first would mean six round trips and six revalidations.
 *
 * One layout for the whole team — an admin decides what the leads table looks like, the same way
 * they decide the stages and the vocabulary.
 */
export function ColumnLayoutEditor({ rows }: { rows: LayoutRow[] }) {
  const [state, formAction] = useActionState(saveColumnLayoutAction, IDLE_FORM_STATE);
  const [order, setOrder] = useState(rows);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= order.length) {
      return;
    }

    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const toggle = (key: string) => {
    setOrder((current) =>
      current.map((row) => (row.key === key ? { ...row, visible: !row.visible } : row)),
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm text-fg">Leads table columns</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          What the team sees, left to right. Widths are set by dragging a column edge on the table
          itself; this is where they are shown and hidden. Name always stays first — it&rsquo;s how
          a lead is opened.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <FormMessage status={state.status} message={state.message} />

        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {order.map((row, index) => (
            <li key={row.key} className="flex items-center gap-3 py-2">
              <input type="hidden" name="columnKey" value={row.key} />
              <input type="hidden" name={`width_${row.key}`} value={row.width} />
              {(row.visible || row.isLocked) && (
                <input type="hidden" name="visible" value={row.key} />
              )}

              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0 || row.isLocked}
                  aria-label={`Move ${row.label} left`}
                  className="flex size-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:text-accent disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronUp className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1 || row.isLocked}
                  aria-label={`Move ${row.label} right`}
                  className="flex size-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:text-accent disabled:pointer-events-none disabled:opacity-25"
                >
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${row.visible || row.isLocked ? "text-fg" : "text-muted"}`}>
                  {row.label}
                </p>
                <p className="text-[11px] text-muted">
                  {row.source === "custom" ? "Extra field" : "Built in"} · {row.width}px
                </p>
              </div>

              {row.isLocked ? (
                <span className="text-[11px] text-muted/50">always shown</span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(row.key)}
                  aria-pressed={row.visible}
                  className={`text-[11px] transition-colors duration-150 ${
                    row.visible ? "text-accent hover:text-fg" : "text-muted hover:text-fg"
                  }`}
                >
                  {row.visible ? "Shown" : "Hidden"}
                </button>
              )}
            </li>
          ))}
        </ul>

        <div>
          <SubmitButton pendingLabel="Saving…" variant="secondary">
            Save columns
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

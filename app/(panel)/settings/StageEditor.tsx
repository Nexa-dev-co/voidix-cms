"use client";

import { useActionState } from "react";

import {
  addPipelineStageAction,
  reorderPipelineStageAction,
  togglePipelineStageAction,
} from "@/app/(panel)/settings/actions";
import { FormMessage } from "@/components/ui/Field";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";

const CONTROL_CLASSES =
  "rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

const KIND_LABELS: Record<string, string> = {
  OPEN: "Open",
  WON: "Won",
  LOST: "Lost",
};

const KIND_TONE: Record<string, string> = {
  OPEN: "text-muted",
  WON: "text-success",
  LOST: "text-danger",
};

export interface StageEntry {
  id: string;
  label: string;
  kind: string;
  isActive: boolean;
}

/**
 * The pipeline stages, in order.
 *
 * Stages are retired rather than deleted: contacts point at the row and the history table
 * snapshots the label as text, so removing one would either orphan leads or rewrite what happened
 * last month. Retiring takes it off the pickers and leaves both intact.
 */
export function StageEditor({ stages }: { stages: StageEntry[] }) {
  const [state, formAction] = useActionState(addPipelineStageAction, IDLE_FORM_STATE);
  const openStageCount = stages.filter(
    (stage) => stage.isActive && stage.kind === "OPEN",
  ).length;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm text-fg">Pipeline stages</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          Where a lead can be in the sales process. The kind is what tells the system a lead is
          finished — an <span className="text-success">Won</span> or{" "}
          <span className="text-danger">Lost</span> lead drops out of the open count and stops
          appearing as overdue.
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {stages.map((stage, index) => {
          // Retiring the last open stage would leave new leads nowhere to land. The action
          // refuses it too; this just explains why the button is off.
          const isLastOpenStage =
            stage.isActive && stage.kind === "OPEN" && openStageCount === 1;

          return (
            <li key={stage.id} className="flex items-center gap-3 py-2">
              <ReorderControls
                id={stage.id}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                moveAction={reorderPipelineStageAction}
                label={stage.label}
              />

              <div className="min-w-0 flex-1">
                <p className={`text-sm ${stage.isActive ? "text-fg" : "text-muted line-through"}`}>
                  {stage.label}
                </p>
                <p className={`text-[11px] ${KIND_TONE[stage.kind] ?? "text-muted"}`}>
                  {KIND_LABELS[stage.kind] ?? stage.kind}
                </p>
              </div>

              <form action={togglePipelineStageAction}>
                <input type="hidden" name="id" value={stage.id} />
                <input type="hidden" name="isActive" value={stage.isActive ? "false" : "true"} />
                <button
                  type="submit"
                  disabled={isLastOpenStage}
                  title={
                    isLastOpenStage
                      ? "The last open stage can't be retired — new leads would have nowhere to land."
                      : undefined
                  }
                  className="text-[11px] text-muted transition-colors duration-150 hover:text-accent disabled:pointer-events-none disabled:opacity-30"
                >
                  {stage.isActive ? "Retire" : "Restore"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <form action={formAction} className="flex flex-col gap-2">
        <FormMessage status={state.status} message={state.message} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="label"
            placeholder="e.g. Negotiating"
            className={`min-w-0 flex-1 ${CONTROL_CLASSES}`}
          />
          <select name="kind" defaultValue="OPEN" aria-label="Stage kind" className={CONTROL_CLASSES}>
            <option value="OPEN">Open</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
          </select>
          <SubmitButton pendingLabel="Adding…" variant="secondary">
            Add
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

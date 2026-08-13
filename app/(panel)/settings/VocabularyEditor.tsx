"use client";

import { useActionState } from "react";

import { addVocabularyAction, toggleVocabularyAction } from "@/app/(panel)/settings/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";

export interface VocabularyEntry {
  id: string;
  label: string;
  isActive: boolean;
}

/**
 * Editor for one attempt vocabulary list.
 *
 * Entries are retired rather than deleted. Attempts store the chosen label as text, so old
 * records stay readable regardless — but keeping the row means a word can be brought back
 * without re-creating it, and nothing has to decide what a "deleted" outcome means.
 */
export function VocabularyEditor({
  kind,
  title,
  hint,
  entries,
}: {
  kind: "channel" | "outcome";
  title: string;
  hint: string;
  entries: VocabularyEntry[];
}) {
  const [state, formAction] = useActionState(addVocabularyAction, IDLE_FORM_STATE);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm text-fg">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p>
      </div>

      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
            <span className={`text-sm ${entry.isActive ? "text-fg" : "text-muted line-through"}`}>
              {entry.label}
            </span>
            <form action={toggleVocabularyAction}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="isActive" value={entry.isActive ? "false" : "true"} />
              <button
                type="submit"
                className="text-[11px] text-muted transition-colors duration-150 hover:text-accent"
              >
                {entry.isActive ? "Retire" : "Restore"}
              </button>
            </form>
          </li>
        ))}
      </ul>

      {entries.length === 0 && (
        <p className="text-xs text-muted">Nothing here yet — add the first one below.</p>
      )}

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="kind" value={kind} />
        <FormMessage status={state.status} message={state.message} />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="label"
            placeholder={kind === "channel" ? "e.g. LinkedIn" : "e.g. Asked to call back"}
            className="min-w-0 flex-1 rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          />
          <SubmitButton pendingLabel="Adding…" variant="secondary">
            Add
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

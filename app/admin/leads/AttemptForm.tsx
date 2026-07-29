"use client";

import { useActionState } from "react";

import { logAttemptAction } from "@/app/admin/leads/actions";
import { FormMessage, TextAreaField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { CONTACT_LIMITS } from "@/lib/validation/contactSchemas";

const SELECT_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

export function AttemptForm({
  contactId,
  channels,
  outcomes,
}: {
  contactId: string;
  channels: { id: string; label: string }[];
  outcomes: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(logAttemptAction, IDLE_FORM_STATE);

  if (channels.length === 0 || outcomes.length === 0) {
    return (
      <p className="text-xs text-muted">
        An admin needs to add at least one channel and one outcome under Settings before
        attempts can be logged.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="contactId" value={contactId} />

      <FormMessage status={state.status} message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="channel" className="text-xs uppercase tracking-[0.14em] text-muted">
            Channel
          </label>
          <select id="channel" name="channel" className={SELECT_CLASSES}>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.label}>
                {channel.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="outcome" className="text-xs uppercase tracking-[0.14em] text-muted">
            Outcome
          </label>
          <select id="outcome" name="outcome" className={SELECT_CLASSES}>
            {outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.label}>
                {outcome.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TextAreaField
        label="What happened"
        name="note"
        max={CONTACT_LIMITS.notes}
        rows={3}
        error={state.fieldErrors.note}
        hint="Optional."
      />

      <div>
        <SubmitButton pendingLabel="Logging…" variant="secondary">
          Log attempt
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { saveContactNotesAction } from "@/app/(panel)/leads/actions";
import { FormMessage, TextAreaField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { CONTACT_LIMITS } from "@/lib/validation/contactSchemas";

export function ContactNotesForm({ id, notes }: { id: string; notes: string }) {
  const [state, formAction] = useActionState(saveContactNotesAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />

      <FormMessage status={state.status} message={state.message} />

      <TextAreaField
        label="Internal notes"
        name="notes"
        defaultValue={notes}
        max={CONTACT_LIMITS.notes}
        rows={4}
        hint="Only ever visible in this panel."
      />

      <div>
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save notes
        </SubmitButton>
      </div>
    </form>
  );
}

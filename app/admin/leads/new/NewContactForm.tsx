"use client";

import { useActionState } from "react";

import { createContactAction } from "@/app/admin/leads/actions";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { CONTACT_LIMITS } from "@/lib/validation/contactSchemas";

export function NewContactForm() {
  const [state, formAction] = useActionState(createContactAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage status={state.status} message={state.message} />

      <TextField
        label="Name"
        name="name"
        max={CONTACT_LIMITS.name}
        error={state.fieldErrors.name}
      />

      <TextField
        label="Email"
        name="email"
        max={CONTACT_LIMITS.email}
        error={state.fieldErrors.email}
        hint="The one field that identifies a person here — it's what keeps them from being duplicated."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Company"
          name="company"
          max={CONTACT_LIMITS.company}
          error={state.fieldErrors.company}
        />
        <TextField
          label="Phone"
          name="phone"
          max={CONTACT_LIMITS.phone}
          error={state.fieldErrors.phone}
        />
      </div>

      <TextAreaField
        label="Notes on this approach"
        name="message"
        max={CONTACT_LIMITS.message}
        rows={5}
        error={state.fieldErrors.message}
        hint="Optional. What they want, where they came from — becomes the first entry in their history."
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Adding…">Add lead</SubmitButton>
        <ButtonLink href="/admin/leads" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

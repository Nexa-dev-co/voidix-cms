"use client";

import { useActionState } from "react";

import { updateContactAction } from "@/app/admin/(content)/contact/actions";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface ContactFormValues {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  emailAddress: string;
  formNameLabel: string;
  formEmailLabel: string;
  formMessageLabel: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
}

export function ContactForm({ contact }: { contact: ContactFormValues }) {
  const [state, formAction] = useActionState(updateContactAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Section copy</legend>

        <TextField
          label="Eyebrow"
          name="eyebrow"
          defaultValue={contact.eyebrow}
          max={FIELD_LIMITS.contactEyebrow}
          error={state.fieldErrors.eyebrow}
          hint="The small kicker above the heading."
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Title line 1"
            name="titleLine1"
            defaultValue={contact.titleLine1}
            max={FIELD_LIMITS.contactTitleLine}
            error={state.fieldErrors.titleLine1}
          />
          <TextField
            label="Title line 2"
            name="titleLine2"
            defaultValue={contact.titleLine2}
            max={FIELD_LIMITS.contactTitleLine}
            error={state.fieldErrors.titleLine2}
          />
        </div>
        <p className="-mt-3 text-[11px] leading-relaxed text-muted">
          Two separate lines, not one string — the site&rsquo;s section titles break on an
          explicit line break, so a stray newline in one field would not land where you expect.
        </p>

        <TextAreaField
          label="Description"
          name="description"
          defaultValue={contact.description}
          max={FIELD_LIMITS.contactDescription}
          rows={4}
          error={state.fieldErrors.description}
        />

        <TextField
          label="Email address"
          name="emailAddress"
          defaultValue={contact.emailAddress}
          max={FIELD_LIMITS.contactEmail}
          error={state.fieldErrors.emailAddress}
          hint="Shown to visitors. This is not where form submissions are delivered — those come into Leads."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">Form strings</legend>

        <div className="grid gap-6 sm:grid-cols-3">
          <TextField
            label="Name label"
            name="formNameLabel"
            defaultValue={contact.formNameLabel}
            max={FIELD_LIMITS.contactFormLabel}
            error={state.fieldErrors.formNameLabel}
          />
          <TextField
            label="Email label"
            name="formEmailLabel"
            defaultValue={contact.formEmailLabel}
            max={FIELD_LIMITS.contactFormLabel}
            error={state.fieldErrors.formEmailLabel}
          />
          <TextField
            label="Message label"
            name="formMessageLabel"
            defaultValue={contact.formMessageLabel}
            max={FIELD_LIMITS.contactFormLabel}
            error={state.fieldErrors.formMessageLabel}
          />
        </div>

        <TextField
          label="Submit button"
          name="submitLabel"
          defaultValue={contact.submitLabel}
          max={FIELD_LIMITS.contactSubmitLabel}
          error={state.fieldErrors.submitLabel}
        />

        <TextField
          label="Success message"
          name="successMessage"
          defaultValue={contact.successMessage}
          max={FIELD_LIMITS.contactMessage}
          error={state.fieldErrors.successMessage}
          hint="Shown after a message sends."
        />

        <TextField
          label="Error message"
          name="errorMessage"
          defaultValue={contact.errorMessage}
          max={FIELD_LIMITS.contactMessage}
          error={state.fieldErrors.errorMessage}
          hint="Shown when sending fails. Say what to do next, not just that it broke."
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

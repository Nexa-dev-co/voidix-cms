"use client";

import { useActionState } from "react";

import { updateContactAction } from "@/app/(panel)/(content)/contact/actions";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface ContactFormValues {
  title: string;
  lead: string;
  briefLabel: string;
  submitLabel: string;
}

export function ContactForm({ contact }: { contact: ContactFormValues }) {
  const [state, formAction] = useActionState(updateContactAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Section copy</legend>

        <TextField
          label="Title"
          name="title"
          defaultValue={contact.title}
          max={FIELD_LIMITS.contactTitle}
          error={state.fieldErrors.title}
          hint="One line, not two — unlike the site's other section titles, this one is a single string."
        />

        <TextAreaField
          label="Lead"
          name="lead"
          defaultValue={contact.lead}
          max={FIELD_LIMITS.contactLead}
          rows={4}
          error={state.fieldErrors.lead}
          hint="The promise in this paragraph is real. Don't say a visitor will hear back from the people who would build it unless that is true — it is the one line here they can hold the studio to."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">Form strings</legend>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Long field label"
            name="briefLabel"
            defaultValue={contact.briefLabel}
            max={FIELD_LIMITS.contactBriefLabel}
            error={state.fieldErrors.briefLabel}
            hint="Names the box where the visitor describes the project."
          />
          <TextField
            label="Submit button"
            name="submitLabel"
            defaultValue={contact.submitLabel}
            max={FIELD_LIMITS.contactSubmitLabel}
            error={state.fieldErrors.submitLabel}
          />
        </div>

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          These two are the only form strings the site can read. The Name, Email and Phone labels
          and the sent/failed messages are written into{" "}
          <code className="text-fg">EnquiryForm.tsx</code>, and the section&rsquo;s{" "}
          <code className="text-fg">04 — Start a project</code> kicker into{" "}
          <code className="text-fg">ContactSection.tsx</code>. They are not listed here on purpose:
          a field you can edit that changes nothing on the site is worse than no field at all.
        </p>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { updateEnquiryFormAction } from "@/app/(panel)/(content)/enquiry-form/actions";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface EnquiryFormValues {
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  sendingLabel: string;
  sentMessage: string;
  errorMessage: string;
  referenceSubjectSuffix: string;
  referenceBriefPrefix: string;
}

export interface DisciplineValues {
  key: string;
  label: string;
  briefSeed: string;
}

export function EnquiryFormEditor({
  enquiryForm,
  disciplines,
}: {
  enquiryForm: EnquiryFormValues;
  disciplines: DisciplineValues[];
}) {
  const [state, formAction] = useActionState(updateEnquiryFormAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Field labels</legend>

        <div className="grid gap-6 sm:grid-cols-3">
          <TextField
            label="Name"
            rendersAs="field label"
            name="nameLabel"
            defaultValue={enquiryForm.nameLabel}
            max={FIELD_LIMITS.enquiryFieldLabel}
            error={state.fieldErrors.nameLabel}
          />
          <TextField
            label="Email"
            rendersAs="field label"
            name="emailLabel"
            defaultValue={enquiryForm.emailLabel}
            max={FIELD_LIMITS.enquiryFieldLabel}
            error={state.fieldErrors.emailLabel}
          />
          <TextField
            label="Phone"
            rendersAs="field label"
            name="phoneLabel"
            defaultValue={enquiryForm.phoneLabel}
            max={FIELD_LIMITS.enquiryFieldLabel}
            error={state.fieldErrors.phoneLabel}
          />
        </div>

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          The long field is named per section, because each one asks a different question — see{" "}
          <span className="text-fg">Contact</span> and <span className="text-fg">Careers</span>.
          These three are the same everywhere.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">What happens after Send</legend>

        <TextField
          label="While sending"
          rendersAs="while sending"
          name="sendingLabel"
          defaultValue={enquiryForm.sendingLabel}
          max={FIELD_LIMITS.enquirySendingLabel}
          error={state.fieldErrors.sendingLabel}
          hint="Replaces the button's own label in flight, so it reads as the same control working rather than a different one appearing."
        />

        <TextField
          label="Sent"
          rendersAs="success message"
          name="sentMessage"
          defaultValue={enquiryForm.sentMessage}
          max={FIELD_LIMITS.enquiryMessage}
          error={state.fieldErrors.sentMessage}
          hint="Say what happens next, not just that it worked."
        />

        <TextField
          label="Failed"
          rendersAs="error message"
          name="errorMessage"
          defaultValue={enquiryForm.errorMessage}
          max={FIELD_LIMITS.enquiryMessage}
          error={state.fieldErrors.errorMessage}
          hint="Say what to do next. Someone who has just lost a paragraph needs an instruction, not an apology."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">What the enquiry is about</legend>

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          One vocabulary, shared by three places: the fleet sells a discipline, a project is{" "}
          <em>of</em> one, and the form arrives already knowing which. The label is the plain
          words a visitor would write in an email — not the service&rsquo;s name, which is the
          brand talking. Which service and project points at which lives on{" "}
          <span className="text-fg">Services</span> and <span className="text-fg">Works</span>.
        </p>

        {disciplines.map((discipline) => (
          <div key={discipline.key} className="flex flex-col gap-4 border-l border-border pl-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted/50">
              {discipline.key}
            </p>

            <TextField
              label="Subject"
              name={`label:${discipline.key}`}
              defaultValue={discipline.label}
              max={FIELD_LIMITS.disciplineLabel}
              error={state.fieldErrors[`label:${discipline.key}`]}
            />

            <TextAreaField
              label="Brief seed"
              name={`briefSeed:${discipline.key}`}
              defaultValue={discipline.briefSeed}
              max={FIELD_LIMITS.disciplineBriefSeed}
              rows={3}
              error={state.fieldErrors[`briefSeed:${discipline.key}`]}
              hint="In the visitor's voice, left mid-sentence. Don't add a trailing space — the gap before what they type is added for you."
            />
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">When the enquiry names a project</legend>

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          The works field&rsquo;s call to action points at the project the visitor is looking at,
          so the enquiry opens &ldquo;in the orbit of&rdquo; that one rather than as a cold start.
          Both fields must contain <code className="text-fg">{"{project}"}</code> — that is where
          the name goes, and a template that loses it reads as finished while saying nothing.
        </p>

        <TextField
          label="Added to the subject"
          rendersAs="appended to the subject"
          name="referenceSubjectSuffix"
          defaultValue={enquiryForm.referenceSubjectSuffix}
          max={FIELD_LIMITS.referenceSubjectSuffix}
          error={state.fieldErrors.referenceSubjectSuffix}
          hint="Follows the discipline's subject. With “ — like {project}” an enquiry reads “Enterprise Platform — like Aphelion”."
        />

        <TextField
          label="Added before the brief"
          rendersAs="leads the brief"
          name="referenceBriefPrefix"
          defaultValue={enquiryForm.referenceBriefPrefix}
          max={FIELD_LIMITS.referenceBriefPrefix}
          error={state.fieldErrors.referenceBriefPrefix}
          hint="Leads the brief seed. Keep the trailing punctuation and space you want between it and the seed."
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

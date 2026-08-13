"use client";

import { useActionState } from "react";

import { updateServiceAction } from "@/app/(panel)/(content)/services/actions";
import { ButtonLink } from "@/components/ui/Button";
import {
  ChipListField,
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export function ServiceForm({
  service,
  disciplines,
}: {
  service: {
    id: string;
    name: string;
    eyebrow: string;
    description: string;
    capabilities: string[];
    disciplineId: string;
  };
  disciplines: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(updateServiceAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={service.id} />

      <FormMessage status={state.status} message={state.message} />

      <TextField
        label="Name"
        name="name"
        defaultValue={service.name}
        max={FIELD_LIMITS.serviceName}
        error={state.fieldErrors.name}
        hint="Shown in the four-across carousel strip. Long names crowd their neighbours."
      />

      <TextField
        label="Eyebrow"
        name="eyebrow"
        defaultValue={service.eyebrow}
        max={FIELD_LIMITS.serviceEyebrow}
        error={state.fieldErrors.eyebrow}
        hint="The poetic kicker above the description. One line."
      />

      <TextAreaField
        label="Description"
        name="description"
        defaultValue={service.description}
        max={FIELD_LIMITS.serviceDescription}
        rows={5}
        error={state.fieldErrors.description}
        hint="One paragraph, plain text."
      />

      <ChipListField
        label="Capabilities"
        name="capabilities"
        defaultValue={service.capabilities}
        maxLabel={FIELD_LIMITS.capabilityLabel}
        maxCount={FIELD_LIMITS.capabilityCount}
        error={state.fieldErrors.capabilities}
        hint="Comma separated. Order is the order they appear in."
      />

      <SelectField
        label="Enquiries about"
        name="disciplineId"
        defaultValue={service.disciplineId}
        options={disciplines.map((discipline) => ({
          value: discipline.id,
          label: discipline.label,
        }))}
        error={state.fieldErrors.disciplineId}
        hint="What this craft's call to action asks about. The plain words a visitor would write in an email, not the name above — edit the wording under Enquiry form."
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
        <ButtonLink href="/services" variant="ghost">
          Back
        </ButtonLink>
      </div>
    </form>
  );
}

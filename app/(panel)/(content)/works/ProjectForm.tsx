"use client";

import { useActionState } from "react";

import { createProjectAction, updateProjectAction } from "@/app/(panel)/(content)/works/actions";
import { MarkUploadField } from "@/app/(panel)/(content)/works/MarkUploadField";
import { ButtonLink } from "@/components/ui/Button";
import {
  ChipListField,
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MARK_FILE_FIELD } from "@/lib/content/markStorage";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface ProjectFormValues {
  id?: string;
  title: string;
  client: string;
  year: string;
  description: string;
  tags: string[];
  disciplineId: string;
  /** The mark already stored for this project, so the field can show what it is replacing. */
  markSvgUrl?: string | null;
}

export function ProjectForm({
  project,
  disciplines,
}: {
  project?: ProjectFormValues;
  disciplines: { id: string; label: string }[];
}) {
  const isEditing = Boolean(project?.id);
  const [state, formAction] = useActionState(
    isEditing ? updateProjectAction : createProjectAction,
    IDLE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {project?.id && <input type="hidden" name="id" value={project.id} />}

      <FormMessage status={state.status} message={state.message} />

      <TextField
        label="Title"
        name="title"
        defaultValue={project?.title ?? ""}
        max={FIELD_LIMITS.projectTitle}
        error={state.fieldErrors.title}
        hint="The codename shown on the project. Short and hard-edged."
      />

      <div className="grid gap-6 sm:grid-cols-[1fr_8rem]">
        <TextField
          label="Client"
          name="client"
          defaultValue={project?.client ?? ""}
          max={FIELD_LIMITS.projectClient}
          error={state.fieldErrors.client}
          hint="Who it was built for, or the context."
        />
        <TextField
          label="Year"
          name="year"
          defaultValue={project?.year ?? ""}
          max={FIELD_LIMITS.projectYear}
          error={state.fieldErrors.year}
          placeholder="2026"
        />
      </div>

      <TextAreaField
        label="Description"
        name="description"
        defaultValue={project?.description ?? ""}
        max={FIELD_LIMITS.projectDescription}
        rows={5}
        error={state.fieldErrors.description}
        hint="One paragraph, plain text."
      />

      <ChipListField
        label="Tags"
        name="tags"
        defaultValue={project?.tags ?? []}
        maxLabel={FIELD_LIMITS.tagLabel}
        maxCount={FIELD_LIMITS.tagCount}
        error={state.fieldErrors.tags}
        hint="Comma separated. Order is the order they appear in."
      />

      <MarkUploadField
        currentUrl={project?.markSvgUrl}
        error={state.fieldErrors[MARK_FILE_FIELD]}
      />

      <SelectField
        label="Kind of work"
        name="disciplineId"
        defaultValue={project?.disciplineId ?? disciplines[0]?.id}
        options={disciplines.map((discipline) => ({
          value: discipline.id,
          label: discipline.label,
        }))}
        error={state.fieldErrors.disciplineId}
        hint="Renders as the project's type key, and decides what its call to action enquires about. Same vocabulary the services sell — edit the wording under Enquiry form."
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel={isEditing ? "Saving…" : "Adding…"}>
          {isEditing ? "Save draft" : "Add project"}
        </SubmitButton>
        <ButtonLink href="/works" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

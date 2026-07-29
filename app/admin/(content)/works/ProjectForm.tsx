"use client";

import { useActionState } from "react";

import { createProjectAction, updateProjectAction } from "@/app/admin/(content)/works/actions";
import { ButtonLink } from "@/components/ui/Button";
import { ChipListField, FormMessage, TextAreaField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface ProjectFormValues {
  id?: string;
  title: string;
  client: string;
  year: string;
  description: string;
  tags: string[];
}

export function ProjectForm({ project }: { project?: ProjectFormValues }) {
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

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel={isEditing ? "Saving…" : "Adding…"}>
          {isEditing ? "Save draft" : "Add project"}
        </SubmitButton>
        <ButtonLink href="/admin/works" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

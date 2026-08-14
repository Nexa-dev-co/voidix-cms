"use client";

import { useActionState } from "react";

import { createRoleAction, updateRoleAction } from "@/app/(panel)/(content)/careers/actions";
import { FormMessage, LineListField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface RoleFormValues {
  id: string;
  title: string;
  location: string;
  commitment: string;
  owns: string[];
  needs: string[];
  bonus: string[];
  briefSeed: string;
}

export function RoleForm({ role }: { role?: RoleFormValues }) {
  const [state, formAction] = useActionState(
    role ? updateRoleAction : createRoleAction,
    IDLE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {role && <input type="hidden" name="id" value={role.id} />}

      <FormMessage status={state.status} message={state.message} />

      {/* The two fieldsets are the site's two states, in the site's order. On /careers a role is a
          row that opens in place, so everything above the fold of that row is typed first and the
          panel's three lists second — an editor filling this in top to bottom is filling in the
          page top to bottom. */}
      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">The row, closed</legend>

        <TextField
          label="Title"
          rendersAs="row heading"
          name="title"
          defaultValue={role?.title ?? ""}
          max={FIELD_LIMITS.roleTitle}
          error={state.fieldErrors.title}
          placeholder="Senior Creative Engineer — WebGL"
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Location"
            rendersAs="under the title"
            name="location"
            defaultValue={role?.location ?? ""}
            max={FIELD_LIMITS.roleLocation}
            error={state.fieldErrors.location}
            placeholder="Remote (CET ±3)"
            hint="Decided per role, not studio-wide — whichever this opening actually needs. Sits beside Commitment, separated by a dot."
          />
          <TextField
            label="Commitment"
            rendersAs="under the title"
            name="commitment"
            defaultValue={role?.commitment ?? ""}
            max={FIELD_LIMITS.roleCommitment}
            error={state.fieldErrors.commitment}
            placeholder="Full-time"
            hint="Full-time, contract or fixed term — again, whatever this work needs."
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">The panel, open</legend>

        {/* Labels are the site's own headings, verbatim. An editor should be able to read a word
            here, then find that same word on /careers — "Owns" appeared nowhere the visitor
            could see it. */}
        <LineListField
          label="What you'd own"
          rendersAs="bullets"
          name="owns"
          defaultValue={role?.owns ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.owns}
          placeholder={"One responsibility per line."}
          hint="What this person would be responsible for. One per line, left column of the open panel."
        />

        <LineListField
          label="What we need to see"
          rendersAs="bullets"
          name="needs"
          defaultValue={role?.needs ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.needs}
          placeholder={"One requirement per line."}
          hint="What you would need to see to take the application seriously. Right column, beside the list above."
        />

        {/* Typed one per line, drawn as chips. The input can't split on commas — "Native graphics
            (Metal, Vulkan)" is one chip — so the preview carries the warning instead. */}
        <LineListField
          label="Nice, genuinely not required"
          rendersAs="chips"
          previewAs="chips"
          name="bonus"
          defaultValue={role?.bonus ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.bonus}
          placeholder={"Optional — leave empty if there is nothing genuine to add."}
          hint="Still one per line, but these draw as chips rather than bullets, so short phrases sit far better than sentences. Genuinely optional, and the page labels it as such — padding this list is why good people don't apply, so an empty one is a valid answer."
        />

        <TextField
          label="Brief seed"
          rendersAs="seeds the Apply form"
          name="briefSeed"
          defaultValue={role?.briefSeed ?? ""}
          max={FIELD_LIMITS.applicationSeed}
          error={state.fieldErrors.briefSeed}
          placeholder="The last thing I built that I would defend line by line is"
          hint="Not shown on the role itself. It pre-fills the long field of the application form that opens from “Apply for this role”, in the applicant's voice and left mid-sentence so it reads as a note they started. Don't add a trailing space — the applicant continues this sentence, and the gap is added for you."
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel={role ? "Saving…" : "Adding…"}>
          {role ? "Save draft" : "Add role"}
        </SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { createRoleAction, updateRoleAction } from "@/app/admin/(content)/careers/actions";
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

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">The opening</legend>

        <TextField
          label="Title"
          name="title"
          defaultValue={role?.title ?? ""}
          max={FIELD_LIMITS.roleTitle}
          error={state.fieldErrors.title}
          placeholder="Senior Creative Engineer — WebGL"
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Location"
            name="location"
            defaultValue={role?.location ?? ""}
            max={FIELD_LIMITS.roleLocation}
            error={state.fieldErrors.location}
            placeholder="Remote (CET ±3)"
            hint="Decided per role, not studio-wide — whichever this opening actually needs."
          />
          <TextField
            label="Commitment"
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
        <legend className="eyebrow mb-4">What the role is</legend>

        <LineListField
          label="Owns"
          name="owns"
          defaultValue={role?.owns ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.owns}
          placeholder={"One responsibility per line."}
          hint="What this person would be responsible for. One per line."
        />

        <LineListField
          label="Needs"
          name="needs"
          defaultValue={role?.needs ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.needs}
          placeholder={"One requirement per line."}
          hint="What you would need to see to take the application seriously."
        />

        <LineListField
          label="Bonus"
          name="bonus"
          defaultValue={role?.bonus ?? []}
          maxEntry={FIELD_LIMITS.roleBullet}
          maxCount={FIELD_LIMITS.roleBulletCount}
          error={state.fieldErrors.bonus}
          placeholder={"Optional — leave empty if there is nothing genuine to add."}
          hint="Genuinely optional, and the page labels it as such. Padding this list is why good people don't apply, so an empty one is a valid answer."
        />

        <TextField
          label="Brief seed"
          name="briefSeed"
          defaultValue={role?.briefSeed ?? ""}
          max={FIELD_LIMITS.applicationSeed}
          error={state.fieldErrors.briefSeed}
          placeholder="The last thing I built that I would defend line by line is"
          hint="Seeds the application form's long field. In the applicant's voice and left mid-sentence, so it reads as a note they started. Don't add a trailing space — the applicant continues this sentence, and the gap is added for you."
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

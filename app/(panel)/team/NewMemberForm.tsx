"use client";

import { useActionState } from "react";

import { createTeamMemberAction } from "@/app/(panel)/team/actions";
import { CredentialNotice } from "@/app/(panel)/team/CredentialNotice";
import { FormMessage, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_TEAM_FORM_STATE } from "@/lib/forms/teamFormState";
import { CONTACT_LIMITS } from "@/lib/validation/contactSchemas";

export function NewMemberForm() {
  const [state, formAction] = useActionState(createTeamMemberAction, IDLE_TEAM_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-sm border border-border p-5">
      <div>
        <h2 className="eyebrow mb-1">Add someone</h2>
        <p className="text-xs leading-relaxed text-muted">
          Creates their login and their permissions together. They can sign in straight away.
        </p>
      </div>

      <FormMessage status={state.status} message={state.message} />

      {state.temporaryPassword && state.createdEmail && (
        <CredentialNotice email={state.createdEmail} password={state.temporaryPassword} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Name"
          name="name"
          max={CONTACT_LIMITS.memberName}
          error={state.fieldErrors.name}
        />
        <TextField
          label="Email"
          name="email"
          max={CONTACT_LIMITS.email}
          error={state.fieldErrors.email}
          hint="This becomes their username."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-xs uppercase tracking-[0.14em] text-muted">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="SALES"
          className="rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
        >
          <option value="SALES">Sales — leads only</option>
          <option value="ADMIN">Admin — everything, including publishing</option>
        </select>
      </div>

      <div>
        <SubmitButton pendingLabel="Creating…">Create login</SubmitButton>
      </div>
    </form>
  );
}

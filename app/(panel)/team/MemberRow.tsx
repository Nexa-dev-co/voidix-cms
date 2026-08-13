"use client";

import { useActionState } from "react";

import {
  removeMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  setMemberRoleAction,
} from "@/app/(panel)/team/actions";
import { CredentialNotice } from "@/app/(panel)/team/CredentialNotice";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_TEAM_FORM_STATE } from "@/lib/forms/teamFormState";
import type { TeamRole } from "@/generated/prisma/enums";

export interface MemberRowData {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isActive: boolean;
  hasLogin: boolean;
  assignedCount: number;
}

export function MemberRow({ member, isSelf }: { member: MemberRowData; isSelf: boolean }) {
  const [resetState, resetAction] = useActionState(
    resetMemberPasswordAction,
    IDLE_TEAM_FORM_STATE,
  );

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm ${member.isActive ? "text-fg" : "text-muted line-through"}`}>
            {member.name}
            {isSelf && <span className="ml-2 text-[11px] text-accent">you</span>}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{member.email}</p>
          <p className="mt-1 text-[11px] text-muted/60">
            {member.assignedCount} lead{member.assignedCount === 1 ? "" : "s"} assigned
            {member.hasLogin ? "" : " · no login"}
          </p>
        </div>

        <form action={setMemberRoleAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={member.id} />
          <select
            name="role"
            defaultValue={member.role}
            className="rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          >
            <option value="SALES">Sales</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button type="submit" className="text-[11px] text-accent hover:underline">
            Set
          </button>
        </form>

        <form action={setMemberActiveAction}>
          <input type="hidden" name="id" value={member.id} />
          <input type="hidden" name="isActive" value={member.isActive ? "false" : "true"} />
          <Button type="submit" variant="secondary">
            {member.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form action={resetAction}>
          <input type="hidden" name="id" value={member.id} />
          <SubmitButton pendingLabel="Resetting…" variant="secondary">
            New password
          </SubmitButton>
        </form>

        {!isSelf && (
          <form action={removeMemberAction}>
            <input type="hidden" name="id" value={member.id} />
            <ConfirmSubmitButton
              confirmMessage={`Remove ${member.name} and delete their login? Leads they own become unassigned rather than being deleted.`}
              pendingLabel="Removing…"
            >
              Remove
            </ConfirmSubmitButton>
          </form>
        )}

        {resetState.status === "error" && (
          <p className="text-xs text-danger">{resetState.message}</p>
        )}
      </div>

      {resetState.temporaryPassword && resetState.createdEmail && (
        <CredentialNotice
          email={resetState.createdEmail}
          password={resetState.temporaryPassword}
        />
      )}
    </div>
  );
}

"use client";

import { useRef } from "react";

import { assignContactAction } from "@/app/(panel)/leads/actions";

/**
 * Owner picker that submits on change.
 *
 * Wrapped in a real form posting to a server action rather than an onChange fetch, so it still
 * works without JavaScript; the `requestSubmit` here only removes the extra click when JS is
 * available.
 */
export function AssignSelect({
  contactId,
  assignedToId,
  members,
}: {
  contactId: string;
  assignedToId: string | null;
  members: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={assignContactAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={contactId} />
      <select
        name="assignedToId"
        defaultValue={assignedToId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-xs text-accent">
          Assign
        </button>
      </noscript>
    </form>
  );
}

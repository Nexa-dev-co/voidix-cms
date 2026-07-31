"use client";

import { quickNoAnswerAction } from "@/app/admin/leads/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/**
 * The one-click path for the most common dead end.
 *
 * A rung out phone teaches you nothing about a lead, so walking four wizard steps to record it is
 * friction for no information. This logs the attempt and pushes the follow-up date, leaving the
 * stage alone.
 *
 * The labels are resolved on the server from the live vocabulary and passed in, and the action
 * resolves them again the same way — so what the button says and what it writes cannot drift if
 * an admin renames "No answer".
 */
export function QuickNoAnswerButton({
  contactId,
  outcomeLabel,
  days,
}: {
  contactId: string;
  outcomeLabel: string;
  days: number;
}) {
  return (
    <form action={quickNoAnswerAction}>
      <input type="hidden" name="contactId" value={contactId} />
      <SubmitButton pendingLabel="Logging…" variant="secondary">
        {`${outcomeLabel} · +${days}d`}
      </SubmitButton>
    </form>
  );
}

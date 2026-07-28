"use client";

import { useFormStatus } from "react-dom";

import { buttonClasses } from "@/components/ui/Button";

/**
 * Submit button gated behind a native confirm.
 *
 * Deletes here are unrecoverable at the draft level — the row and its children go — so the
 * prompt names the thing being deleted rather than asking a generic "are you sure?". The
 * last published release still holds a copy, which is the actual safety net.
 */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingLabel,
}: {
  children: string;
  confirmMessage: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      className={buttonClasses("danger")}
    >
      {pending ? (pendingLabel ?? `${children}…`) : children}
    </button>
  );
}

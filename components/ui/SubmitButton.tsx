"use client";

import { useFormStatus } from "react-dom";

import { buttonClasses } from "@/components/ui/Button";

/**
 * A submit button that disables itself while its form is in flight.
 *
 * Reads `useFormStatus`, so it has to be a child of the `<form>` rather than the component
 * that renders it — that's the whole reason this is its own file.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClasses(variant, className)}
    >
      {pending ? (pendingLabel ?? `${children}…`) : children}
    </button>
  );
}

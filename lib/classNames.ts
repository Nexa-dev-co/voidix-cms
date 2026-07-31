import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names, letting a later utility win over an earlier one.
 *
 * Plain string concatenation can't do that: `"px-3" + " px-6"` leaves both in the class list and
 * the winner is whichever CSS rule Tailwind emitted last, not the one the caller passed. That
 * matters for every component here that takes a `className` prop to override its own defaults.
 *
 * Named `cn` rather than something longer because the vendored table primitives call it on almost
 * every element — the one place in this codebase where the no-abbreviations rule would cost more
 * in noise than it returns in clarity.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

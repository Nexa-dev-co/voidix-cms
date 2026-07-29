import type { FormState } from "@/lib/forms/formState";

/**
 * Form state for the Team page, which has one thing the other forms don't: a credential that
 * exists exactly once.
 *
 * The temporary password is never stored — Supabase keeps only a hash — so this returned
 * value is the only copy that will ever exist. If the admin doesn't hand it over before
 * navigating away, the fix is a password reset, not a lookup.
 */
export interface TeamFormState extends FormState {
  createdEmail: string | null;
  temporaryPassword: string | null;
  /** True when the login already existed and was linked instead of created. */
  linkedExistingLogin: boolean;
}

export const IDLE_TEAM_FORM_STATE: TeamFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  createdEmail: null,
  temporaryPassword: null,
  linkedExistingLogin: false,
};

export function teamFormError(message: string): TeamFormState {
  return { ...IDLE_TEAM_FORM_STATE, status: "error", message };
}

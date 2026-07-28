import type { ZodError } from "zod";

export interface FormState {
  status: "idle" | "error" | "success";
  message: string | null;
  /** Keyed by field name, so each input can render its own error underneath itself. */
  fieldErrors: Record<string, string>;
}

export const IDLE_FORM_STATE: FormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};

export function formError(message: string): FormState {
  return { status: "error", message, fieldErrors: {} };
}

export function formSuccess(message: string): FormState {
  return { status: "success", message, fieldErrors: {} };
}

/**
 * Flattens a Zod issue list into one error per field, keeping the first issue for each.
 * Later issues on the same field are almost always consequences of the first one.
 */
export function formErrorFromZod(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return {
    status: "error",
    message: "Nothing was saved — check the fields below.",
    fieldErrors,
  };
}

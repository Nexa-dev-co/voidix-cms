import { z } from "zod";

import { toPlainLine } from "@/lib/text/plainText";

export const CONTACT_LIMITS = {
  name: 120,
  email: 320,
  company: 120,
  phone: 40,
  message: 4000,
  notes: 2000,
  memberName: 120,
  stageLabel: 60,
  stageReason: 200,
} as const;

/**
 * The one place an email is turned into its stored form.
 *
 * Lowercasing here is not cosmetic — `contacts.email` carries a unique index, and that index
 * is the whole mechanism preventing one person from existing twice. If some paths stored
 * `Sarah@Acme.com` and others `sarah@acme.com`, the database would happily hold both and the
 * duplicate problem would quietly return through the back door.
 */
export function normaliseEmail(value: string): string {
  return toPlainLine(value).toLowerCase();
}

const emailField = z
  .string()
  .transform(normaliseEmail)
  .refine((value) => value.length > 0, { message: "Email is required." })
  .refine((value) => value.length <= CONTACT_LIMITS.email, {
    message: `Email must be ${CONTACT_LIMITS.email} characters or fewer.`,
  })
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "That doesn't look like an email address.",
  });

const optionalLine = (max: number, label: string) =>
  z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    })
    .transform((value) => (value.length > 0 ? value : null));

/** Adding or editing a contact by hand in the panel. */
export const contactRecordSchema = z.object({
  name: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Name is required." })
    .refine((value) => value.length <= CONTACT_LIMITS.name, {
      message: `Name must be ${CONTACT_LIMITS.name} characters or fewer.`,
    }),
  email: emailField,
  company: optionalLine(CONTACT_LIMITS.company, "Company"),
  phone: optionalLine(CONTACT_LIMITS.phone, "Phone"),
  message: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= CONTACT_LIMITS.message, {
      message: `Message must be ${CONTACT_LIMITS.message} characters or fewer.`,
    })
    .transform((value) => (value.length > 0 ? value : null)),
});

export const contactNotesSchema = z
  .string()
  .transform(toPlainLine)
  .refine((value) => value.length <= CONTACT_LIMITS.notes, {
    message: `Notes must be ${CONTACT_LIMITS.notes} characters or fewer.`,
  });

export const attemptSchema = z.object({
  channel: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Pick a channel." })
    .refine((value) => value.length <= 40, { message: "That channel name is too long." }),
  outcome: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Pick an outcome." })
    .refine((value) => value.length <= 60, { message: "That outcome name is too long." }),
  note: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= CONTACT_LIMITS.notes, {
      message: `Note must be ${CONTACT_LIMITS.notes} characters or fewer.`,
    })
    .transform((value) => (value.length > 0 ? value : null)),
});

/**
 * One pass through the follow-up wizard.
 *
 * Everything past the channel and outcome is optional, because the wizard is one flow that may
 * end in several places: some calls move a lead and book the next one, some only record that it
 * happened. The action decides what to write from which of these came back filled in.
 */
export const followUpSchema = z.object({
  channel: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Pick a channel." })
    .refine((value) => value.length <= 40, { message: "That channel name is too long." }),
  outcome: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Pick an outcome." })
    .refine((value) => value.length <= 60, { message: "That outcome name is too long." }),
  note: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= CONTACT_LIMITS.notes, {
      message: `Note must be ${CONTACT_LIMITS.notes} characters or fewer.`,
    })
    .transform((value) => (value.length > 0 ? value : null)),
  /** Empty means "leave the lead where it is", which is a normal outcome rather than a mistake. */
  stageId: z
    .string()
    .transform((value) => value.trim())
    .transform((value) => (value.length > 0 ? value : null)),
  /** `YYYY-MM-DD` from a native date input, or empty for "nothing booked". */
  nextFollowUpDate: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "That follow-up date isn't a date.",
    })
    .transform((value) => (value.length > 0 ? value : null)),
  reason: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= CONTACT_LIMITS.stageReason, {
      message: `Reason must be ${CONTACT_LIMITS.stageReason} characters or fewer.`,
    })
    .transform((value) => (value.length > 0 ? value : null)),
});

/** Creating or renaming a pipeline stage. */
export const pipelineStageSchema = z.object({
  label: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "A stage needs a name." })
    .refine((value) => value.length <= CONTACT_LIMITS.stageLabel, {
      message: `Name must be ${CONTACT_LIMITS.stageLabel} characters or fewer.`,
    }),
  kind: z.enum(["OPEN", "WON", "LOST"]),
});

export const teamMemberSchema = z.object({
  name: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Name is required." })
    .refine((value) => value.length <= CONTACT_LIMITS.memberName, {
      message: `Name must be ${CONTACT_LIMITS.memberName} characters or fewer.`,
    }),
  email: emailField,
  role: z.enum(["ADMIN", "SALES"]),
});

export type ContactRecordInput = z.infer<typeof contactRecordSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

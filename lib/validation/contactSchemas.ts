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

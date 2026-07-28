import { z } from "zod";

import { splitIntoParagraphs, toPlainLine } from "@/lib/text/plainText";

// These caps are layout constraints, not paranoia. `name` sits in a four-across carousel
// row, `eyebrow` is a single line above the description, and the whole site is cinematic
// full-bleed type with no reflow safety net. The character counters in the editor read from
// this object, so the limit shown to an editor and the limit enforced on save can't drift.
export const FIELD_LIMITS = {
  serviceName: 80,
  serviceEyebrow: 120,
  serviceDescription: 500,
  capabilityLabel: 40,
  capabilityCount: 8,
  projectTitle: 80,
  projectClient: 120,
  projectYear: 8,
  projectDescription: 500,
  tagLabel: 40,
  tagCount: 8,
  faqQuestion: 200,
  faqParagraph: 800,
  faqParagraphCount: 6,
  releaseNote: 200,
} as const;

/** A required single-line string: HTML stripped, whitespace collapsed, then length-checked. */
function plainLine(max: number, label: string) {
  return z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: `${label} is required.` })
    .refine((value) => value.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    });
}

/** An ordered list of chip labels parsed from one comma-or-newline separated input. */
function chipList(maxLabel: number, maxCount: number, label: string) {
  return z
    .string()
    .transform((value) =>
      value
        .split(/[\n,]/)
        .map((entry) => toPlainLine(entry))
        .filter((entry) => entry.length > 0),
    )
    .refine((entries) => entries.length > 0, { message: `Add at least one ${label}.` })
    .refine((entries) => entries.length <= maxCount, {
      message: `No more than ${maxCount} ${label}s — the row runs out of space.`,
    })
    .refine((entries) => entries.every((entry) => entry.length <= maxLabel), {
      message: `Each ${label} must be ${maxLabel} characters or fewer.`,
    })
    .refine(
      (entries) => new Set(entries.map((entry) => entry.toLowerCase())).size === entries.length,
      { message: `Duplicate ${label}s.` },
    );
}

export const serviceSchema = z.object({
  name: plainLine(FIELD_LIMITS.serviceName, "Name"),
  eyebrow: plainLine(FIELD_LIMITS.serviceEyebrow, "Eyebrow"),
  description: plainLine(FIELD_LIMITS.serviceDescription, "Description"),
  capabilities: chipList(FIELD_LIMITS.capabilityLabel, FIELD_LIMITS.capabilityCount, "capability"),
});

export const projectSchema = z.object({
  title: plainLine(FIELD_LIMITS.projectTitle, "Title"),
  client: plainLine(FIELD_LIMITS.projectClient, "Client"),
  // Kept as a string because the site renders it raw as "{client} · {year}" — that leaves
  // room for "2026" today and "2019–24" later without a component change.
  year: plainLine(FIELD_LIMITS.projectYear, "Year"),
  description: plainLine(FIELD_LIMITS.projectDescription, "Description"),
  tags: chipList(FIELD_LIMITS.tagLabel, FIELD_LIMITS.tagCount, "tag"),
});

export const faqSchema = z.object({
  question: plainLine(FIELD_LIMITS.faqQuestion, "Question"),
  answer: z
    .string()
    .transform(splitIntoParagraphs)
    .refine((paragraphs) => paragraphs.length > 0, { message: "Answer is required." })
    .refine((paragraphs) => paragraphs.length <= FIELD_LIMITS.faqParagraphCount, {
      message: `No more than ${FIELD_LIMITS.faqParagraphCount} paragraphs.`,
    })
    .refine(
      (paragraphs) => paragraphs.every((paragraph) => paragraph.length <= FIELD_LIMITS.faqParagraph),
      { message: `Each paragraph must be ${FIELD_LIMITS.faqParagraph} characters or fewer.` },
    ),
});

export const releaseNoteSchema = z
  .string()
  .transform(toPlainLine)
  .refine((value) => value.length <= FIELD_LIMITS.releaseNote, {
    message: `Note must be ${FIELD_LIMITS.releaseNote} characters or fewer.`,
  });

export type ServiceInput = z.infer<typeof serviceSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type FaqInput = z.infer<typeof faqSchema>;

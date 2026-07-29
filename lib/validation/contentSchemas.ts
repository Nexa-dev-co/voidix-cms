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
  contactEyebrow: 120,
  contactTitleLine: 60,
  contactDescription: 500,
  contactEmail: 320,
  contactFormLabel: 60,
  contactSubmitLabel: 40,
  contactMessage: 200,
  footerTagline: 120,
  footerCopyright: 120,
  footerLinkLabel: 40,
  footerLinkUrl: 500,
  footerSocialCount: 8,
  footerLegalCount: 6,
  leadName: 120,
  leadEmail: 320,
  leadCompany: 120,
  leadMessage: 4000,
  leadNotes: 2000,
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

const emailField = (max: number, label: string) =>
  z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: `${label} is required.` })
    .refine((value) => value.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    })
    // Deliberately loose. Real addresses break every strict pattern people write, and the
    // only test that actually proves an address works is sending to it.
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: `${label} doesn't look like an email address.`,
    });

export const contactSchema = z.object({
  eyebrow: plainLine(FIELD_LIMITS.contactEyebrow, "Eyebrow"),
  titleLine1: plainLine(FIELD_LIMITS.contactTitleLine, "First title line"),
  // The site's section titles are two fixed lines split by an explicit <br/>, so they are
  // modelled as two fields rather than one string with a newline in it.
  titleLine2: plainLine(FIELD_LIMITS.contactTitleLine, "Second title line"),
  description: plainLine(FIELD_LIMITS.contactDescription, "Description"),
  emailAddress: emailField(FIELD_LIMITS.contactEmail, "Email address"),
  formNameLabel: plainLine(FIELD_LIMITS.contactFormLabel, "Name label"),
  formEmailLabel: plainLine(FIELD_LIMITS.contactFormLabel, "Email label"),
  formMessageLabel: plainLine(FIELD_LIMITS.contactFormLabel, "Message label"),
  submitLabel: plainLine(FIELD_LIMITS.contactSubmitLabel, "Submit label"),
  successMessage: plainLine(FIELD_LIMITS.contactMessage, "Success message"),
  errorMessage: plainLine(FIELD_LIMITS.contactMessage, "Error message"),
});

/**
 * Footer links, typed one per line as `Label | https://url`.
 *
 * Only http(s) and root-relative paths are allowed. That rules out `javascript:` — these
 * labels and URLs end up as anchors on a public page, so an unchecked scheme here would be a
 * stored XSS vector reachable by anyone who can log into this panel.
 */
function linkList(maxCount: number, label: string, isRequired: boolean) {
  return z
    .string()
    .transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const separatorIndex = line.indexOf("|");
          if (separatorIndex === -1) {
            return { label: toPlainLine(line), url: "" };
          }
          return {
            label: toPlainLine(line.slice(0, separatorIndex)),
            url: toPlainLine(line.slice(separatorIndex + 1)),
          };
        }),
    )
    .refine((links) => (isRequired ? links.length > 0 : true), {
      message: `Add at least one ${label}.`,
    })
    .refine((links) => links.length <= maxCount, {
      message: `No more than ${maxCount} ${label}s.`,
    })
    .refine((links) => links.every((link) => link.label.length > 0), {
      message: `Every ${label} needs a label before the "|".`,
    })
    .refine((links) => links.every((link) => link.label.length <= FIELD_LIMITS.footerLinkLabel), {
      message: `Each label must be ${FIELD_LIMITS.footerLinkLabel} characters or fewer.`,
    })
    .refine((links) => links.every((link) => link.url.length > 0), {
      message: `Every ${label} needs a URL after the "|".`,
    })
    .refine((links) => links.every((link) => link.url.length <= FIELD_LIMITS.footerLinkUrl), {
      message: `Each URL must be ${FIELD_LIMITS.footerLinkUrl} characters or fewer.`,
    })
    .refine((links) => links.every((link) => isSafeLinkUrl(link.url)), {
      message: "URLs must start with https://, http:// or / — other schemes aren't allowed.",
    });
}

export function isSafeLinkUrl(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const footerSchema = z.object({
  tagline: plainLine(FIELD_LIMITS.footerTagline, "Tagline"),
  copyright: plainLine(FIELD_LIMITS.footerCopyright, "Copyright"),
  socialLinks: linkList(FIELD_LIMITS.footerSocialCount, "social link", false),
  legalLinks: linkList(FIELD_LIMITS.footerLegalCount, "legal link", false),
});

/**
 * An inbound lead. This is the only schema that parses input from outside the panel, so it
 * is the only one where the caller is not a trusted admin — every field is length-capped and
 * stripped of HTML before it reaches the database or the admin's screen.
 */
export const leadIntakeSchema = z.object({
  name: plainLine(FIELD_LIMITS.leadName, "Name"),
  email: emailField(FIELD_LIMITS.leadEmail, "Email"),
  company: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= FIELD_LIMITS.leadCompany, {
      message: `Company must be ${FIELD_LIMITS.leadCompany} characters or fewer.`,
    })
    .optional(),
  message: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length > 0, { message: "Message is required." })
    .refine((value) => value.length <= FIELD_LIMITS.leadMessage, {
      message: `Message must be ${FIELD_LIMITS.leadMessage} characters or fewer.`,
    }),
  source: z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= 40, { message: "Source is too long." })
    .optional(),
});

export const leadNotesSchema = z
  .string()
  .transform(toPlainLine)
  .refine((value) => value.length <= FIELD_LIMITS.leadNotes, {
    message: `Notes must be ${FIELD_LIMITS.leadNotes} characters or fewer.`,
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
export type ContactInput = z.infer<typeof contactSchema>;
export type FooterInput = z.infer<typeof footerSchema>;
export type LeadIntakeInput = z.infer<typeof leadIntakeSchema>;

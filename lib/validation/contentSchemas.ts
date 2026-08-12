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
  // Contact. One title, not two lines — the site renders a single `CONTACT_TITLE`.
  contactTitle: 120,
  contactLead: 500,
  contactBriefLabel: 60,
  contactSubmitLabel: 40,
  // Footer. `signOff` is longer than the old `copyright` because the site's bottom line is a
  // sentence about the studio rather than a © notice.
  footerTagline: 120,
  footerSignOff: 160,
  footerGroupTitle: 40,
  footerGroupCount: 6,
  // 60, not the old 40 — a link's label can be an email address ("hello@voidix.studio").
  footerLinkLabel: 60,
  footerLinkUrl: 500,
  footerLinksPerGroup: 8,
  // The document pages, /about and /careers. `Claim` and `Phase` are shapes the site shares
  // across both, so their limits are shared here too — one shape, one cap.
  claimTitle: 80,
  claimBacking: 400,
  claimCount: 8,
  phaseSpan: 40,
  phaseName: 40,
  phaseDetail: 300,
  phaseCount: 8,
  documentEyebrow: 60,
  documentTitleLine: 60,
  documentLead: 500,
  documentParagraph: 800,
  documentParagraphCount: 6,
  documentQuote: 300,
  documentNote: 300,
  documentClosingTitle: 80,
  documentClosingLead: 300,
  documentInvite: 120,
  instrumentLabel: 40,
  instrumentValue: 40,
  instrumentCount: 6,
  stackItem: 40,
  stackCount: 12,
  rolesEmptyLine: 200,
  rolesEmptyInvite: 60,
  openApplicationTitle: 80,
  openApplicationLead: 300,
  openApplicationSubject: 60,
  applicationSeed: 200,
  applicationLabel: 60,
  applicationSubmitLabel: 40,
  commitmentOption: 40,
  commitmentCount: 6,
  roleTitle: 100,
  roleLocation: 60,
  roleCommitment: 60,
  roleBullet: 300,
  roleBulletCount: 8,
  leadName: 120,
  leadEmail: 320,
  leadCompany: 120,
  leadMessage: 4000,
  // The subject the site's form carries, which names a discipline and sometimes the project the
  // visitor was pointing at — "Artificial Intelligence — like Halcyon". It was 40 and truncated
  // the half that says which project.
  leadSource: 120,
  leadNotes: 2000,
  // The shared enquiry form, and the vocabulary its subject line comes from.
  disciplineLabel: 60,
  disciplineBriefSeed: 300,
  enquiryFieldLabel: 60,
  enquirySendingLabel: 40,
  enquiryMessage: 200,
  referenceSubjectSuffix: 60,
  referenceBriefPrefix: 120,
  // Career applications. `whyYou` shares `leadMessage`'s cap — both are "a person typing as much
  // as they want into the one big box", and two numbers for one shape is two things to drift.
  applicationPhone: 40,
  applicationLink: 500,
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

/**
 * The same, but an empty value is allowed through as an empty string.
 *
 * ⚠ Cleaned and capped exactly like `plainLine` — optional is about whether the field must be
 * FILLED IN, never about whether what arrives is trusted. Every caller is an unauthenticated
 * endpoint, so HTML still gets stripped and the length still gets checked.
 */
function optionalPlainLine(max: number, label: string) {
  return z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= max, {
      message: `${label} must be ${max} characters or fewer.`,
    })
    .optional();
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

/** A uuid arriving from a form. Rejected here rather than handed to a `uuid` column, which
 *  Prisma answers by throwing — turning a tampered select into a crashed page. */
const uuidField = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => value.length > 0, { message: `${label} is required.` })
    .refine((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), {
      message: `${label} is not a valid choice.`,
    });

export const serviceSchema = z.object({
  name: plainLine(FIELD_LIMITS.serviceName, "Name"),
  eyebrow: plainLine(FIELD_LIMITS.serviceEyebrow, "Eyebrow"),
  description: plainLine(FIELD_LIMITS.serviceDescription, "Description"),
  capabilities: chipList(FIELD_LIMITS.capabilityLabel, FIELD_LIMITS.capabilityCount, "capability"),
  disciplineId: uuidField("Discipline"),
});

export const projectSchema = z.object({
  title: plainLine(FIELD_LIMITS.projectTitle, "Title"),
  client: plainLine(FIELD_LIMITS.projectClient, "Client"),
  // Kept as a string because the site renders it raw as "{client} · {year}" — that leaves
  // room for "2026" today and "2019–24" later without a component change.
  year: plainLine(FIELD_LIMITS.projectYear, "Year"),
  description: plainLine(FIELD_LIMITS.projectDescription, "Description"),
  tags: chipList(FIELD_LIMITS.tagLabel, FIELD_LIMITS.tagCount, "tag"),
  disciplineId: uuidField("Discipline"),
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
  // ⚠ One title. The site's `CONTACT_TITLE` is a single string — unlike the two-line section
  // titles elsewhere, which is what this table used to assume.
  title: plainLine(FIELD_LIMITS.contactTitle, "Title"),
  lead: plainLine(FIELD_LIMITS.contactLead, "Lead"),
  briefLabel: plainLine(FIELD_LIMITS.contactBriefLabel, "Long field label"),
  submitLabel: plainLine(FIELD_LIMITS.contactSubmitLabel, "Submit label"),
});

/**
 * Whether a footer destination is one we are willing to render as an anchor.
 *
 * `mailto:` is allowed because the site's contact address lives in the footer's `Direct` group
 * rather than in a field of its own. `tel:` for the same reason, ahead of a phone number ever
 * being added.
 *
 * Everything else is rejected, and that rules out `javascript:` — these hrefs end up as anchors
 * on a public page, so an unchecked scheme is a stored XSS vector reachable by anyone who can
 * log into this panel.
 */
export function isSafeLinkUrl(url: string): boolean {
  // Root-relative, but not protocol-relative: `//evil.com` is an off-site link wearing a path.
  if (url.startsWith("/") && !url.startsWith("//")) {
    return true;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:" ||
      parsed.protocol === "tel:"
    );
  } catch {
    return false;
  }
}

/**
 * Whether the site opens this destination in a new tab.
 *
 * Derived from the href rather than stored, exactly like the ordinals: a column would let the
 * flag and the URL disagree, and there is nothing an editor could do about it if they did.
 * `http(s)` leaves the site; a root-relative path, a `mailto:` and a `tel:` do not — which
 * reproduces the site's hand-maintained `external` flags exactly.
 */
export function isExternalLinkUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

const GROUP_TITLE_LINE = /^\[(.*)\]$/;

/**
 * The footer's titled link columns, typed as one block of text.
 *
 * A group title is a line in square brackets; every line under it is `Label | href`. Brackets
 * rather than "a line with no pipe is a title", which was the other option and which turns a
 * forgotten `|` into a silently created group instead of an error.
 *
 * One field rather than one per group, because the groups themselves are editable — a fixed set
 * of inputs cannot add a fifth column. Same trade as every other list here: it pastes, it
 * reorders by moving lines, and the preview underneath parses it back so nothing is a guess.
 */
const linkGroupList = () =>
  z
    .string()
    .transform((value) => {
      const groups: { title: string; links: { label: string; href: string }[] }[] = [];
      let orphanLinkCount = 0;

      for (const rawLine of value.split("\n")) {
        const line = rawLine.trim();

        if (line.length === 0) {
          continue;
        }

        const titleMatch = GROUP_TITLE_LINE.exec(line);

        if (titleMatch) {
          groups.push({ title: toPlainLine(titleMatch[1]), links: [] });
          continue;
        }

        const currentGroup = groups[groups.length - 1];

        if (!currentGroup) {
          orphanLinkCount += 1;
          continue;
        }

        const separatorIndex = line.indexOf("|");

        currentGroup.links.push(
          separatorIndex === -1
            ? { label: toPlainLine(line), href: "" }
            : {
                label: toPlainLine(line.slice(0, separatorIndex)),
                href: toPlainLine(line.slice(separatorIndex + 1)),
              },
        );
      }

      return { groups, orphanLinkCount };
    })
    .refine((parsed) => parsed.orphanLinkCount === 0, {
      message: "Every link must sit under a group heading like [Studio].",
    })
    .refine((parsed) => parsed.groups.length > 0, {
      message: "Add at least one group, as a heading in square brackets like [Studio].",
    })
    .refine((parsed) => parsed.groups.length <= FIELD_LIMITS.footerGroupCount, {
      message: `No more than ${FIELD_LIMITS.footerGroupCount} groups — the footer runs out of columns.`,
    })
    .refine((parsed) => parsed.groups.every((group) => group.title.length > 0), {
      message: "Every group needs a title inside its brackets.",
    })
    .refine(
      (parsed) =>
        parsed.groups.every((group) => group.title.length <= FIELD_LIMITS.footerGroupTitle),
      { message: `Each group title must be ${FIELD_LIMITS.footerGroupTitle} characters or fewer.` },
    )
    // An empty group renders as a heading over nothing, in a footer already fighting for
    // vertical space on a phone.
    .refine((parsed) => parsed.groups.every((group) => group.links.length > 0), {
      message: "Every group needs at least one link under it.",
    })
    .refine(
      (parsed) =>
        parsed.groups.every((group) => group.links.length <= FIELD_LIMITS.footerLinksPerGroup),
      { message: `No more than ${FIELD_LIMITS.footerLinksPerGroup} links in one group.` },
    )
    .refine(
      (parsed) => parsed.groups.every((group) => group.links.every((link) => link.label.length > 0)),
      { message: 'Every link needs a label before the "|".' },
    )
    .refine(
      (parsed) =>
        parsed.groups.every((group) =>
          group.links.every((link) => link.label.length <= FIELD_LIMITS.footerLinkLabel),
        ),
      { message: `Each link label must be ${FIELD_LIMITS.footerLinkLabel} characters or fewer.` },
    )
    .refine(
      (parsed) => parsed.groups.every((group) => group.links.every((link) => link.href.length > 0)),
      { message: 'Every link needs a destination after the "|".' },
    )
    .refine(
      (parsed) =>
        parsed.groups.every((group) =>
          group.links.every((link) => link.href.length <= FIELD_LIMITS.footerLinkUrl),
        ),
      { message: `Each destination must be ${FIELD_LIMITS.footerLinkUrl} characters or fewer.` },
    )
    .refine(
      (parsed) =>
        parsed.groups.every((group) => group.links.every((link) => isSafeLinkUrl(link.href))),
      {
        message:
          "Destinations must start with https://, http://, mailto:, tel: or / — other schemes aren't allowed.",
      },
    )
    .transform((parsed) => parsed.groups);

export const footerSchema = z.object({
  tagline: plainLine(FIELD_LIMITS.footerTagline, "Tagline"),
  signOff: plainLine(FIELD_LIMITS.footerSignOff, "Sign-off line"),
  linkGroups: linkGroupList(),
});

/**
 * An ordered list of sentences, one per line.
 *
 * Deliberately not `chipList`: that splits on commas as well as newlines, which is right for
 * "Next.js, WebGL, Realtime" and wrong for anything written as prose. Every one of these entries
 * is a full sentence, and most of them contain a comma.
 */
function lineList(maxEntry: number, maxCount: number, label: string, isRequired: boolean) {
  return z
    .string()
    .transform((value) =>
      value
        .split("\n")
        .map((line) => toPlainLine(line))
        .filter((line) => line.length > 0),
    )
    .refine((entries) => (isRequired ? entries.length > 0 : true), {
      message: `Add at least one ${label}.`,
    })
    .refine((entries) => entries.length <= maxCount, {
      message: `No more than ${maxCount} ${label}s.`,
    })
    .refine((entries) => entries.every((entry) => entry.length <= maxEntry), {
      message: `Each ${label} must be ${maxEntry} characters or fewer.`,
    });
}

interface ListPart {
  key: string;
  max: number;
  label: string;
}

/**
 * An ordered list typed one entry per line, with that entry's fields separated by `|`.
 *
 * The same input shape as the footer's link lists, chosen for the same reasons: it pastes well,
 * it reorders by moving a line, and it needs no add/remove button choreography for a list four
 * entries long. Each line is parsed back out under the field in the editor, so the split is
 * never a guess.
 *
 * A missing part is an error rather than an empty string. These render as "span — name — detail"
 * on the site, and a phase silently missing its detail is a gap in the page that nothing else
 * would report.
 */
function delimitedList(parts: readonly ListPart[], maxCount: number, label: string) {
  return z
    .string()
    .transform((value) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const segments = line.split("|");

          return Object.fromEntries(
            parts.map((part, index) => [part.key, toPlainLine(segments[index] ?? "")]),
          ) as Record<string, string>;
        }),
    )
    .refine((entries) => entries.length > 0, { message: `Add at least one ${label}.` })
    .refine((entries) => entries.length <= maxCount, {
      message: `No more than ${maxCount} ${label}s.`,
    })
    .refine(
      (entries) => entries.every((entry) => parts.every((part) => entry[part.key].length > 0)),
      {
        message: `Every ${label} needs all ${parts.length} parts, separated by "|" — ${parts
          .map((part) => part.label)
          .join(" | ")}.`,
      },
    )
    .refine(
      (entries) =>
        entries.every((entry) => parts.every((part) => entry[part.key].length <= part.max)),
      {
        message: `Too long — ${parts
          .map((part) => `${part.label} is capped at ${part.max}`)
          .join(", ")}.`,
      },
    );
}

// The part definitions are exported because the editor renders its preview from exactly the
// same list the server validates against. Two copies would be two places for a label or a cap
// to drift, which is the reason FIELD_LIMITS exists at all.

/** A claim and the thing that backs it up. Shared by About's principles and Careers' claims. */
export const CLAIM_PARTS = [
  { key: "claim", max: FIELD_LIMITS.claimTitle, label: "Claim" },
  { key: "backing", max: FIELD_LIMITS.claimBacking, label: "Backing" },
] as const;

/** A span of time, its name, and what happens in it. Shared by both pages' phase tracks. */
export const PHASE_PARTS = [
  { key: "span", max: FIELD_LIMITS.phaseSpan, label: "Span" },
  { key: "name", max: FIELD_LIMITS.phaseName, label: "Name" },
  { key: "detail", max: FIELD_LIMITS.phaseDetail, label: "Detail" },
] as const;

export const INSTRUMENT_PARTS = [
  { key: "label", max: FIELD_LIMITS.instrumentLabel, label: "Label" },
  { key: "value", max: FIELD_LIMITS.instrumentValue, label: "Value" },
] as const;

const claimList = (label: string) =>
  delimitedList(CLAIM_PARTS, FIELD_LIMITS.claimCount, label).transform((entries) =>
    entries.map((entry) => ({ claim: entry.claim, backing: entry.backing })),
  );

const phaseList = (label: string) =>
  delimitedList(PHASE_PARTS, FIELD_LIMITS.phaseCount, label).transform((entries) =>
    entries.map((entry) => ({ span: entry.span, name: entry.name, detail: entry.detail })),
  );

const paragraphList = (label: string) =>
  z
    .string()
    .transform(splitIntoParagraphs)
    .refine((paragraphs) => paragraphs.length > 0, { message: `${label} is required.` })
    .refine((paragraphs) => paragraphs.length <= FIELD_LIMITS.documentParagraphCount, {
      message: `No more than ${FIELD_LIMITS.documentParagraphCount} paragraphs.`,
    })
    .refine(
      (paragraphs) =>
        paragraphs.every((paragraph) => paragraph.length <= FIELD_LIMITS.documentParagraph),
      {
        message: `Each paragraph must be ${FIELD_LIMITS.documentParagraph} characters or fewer.`,
      },
    );

export const aboutSchema = z.object({
  eyebrow: plainLine(FIELD_LIMITS.documentEyebrow, "Eyebrow"),
  titleLine1: plainLine(FIELD_LIMITS.documentTitleLine, "First title line"),
  titleLine2: plainLine(FIELD_LIMITS.documentTitleLine, "Second title line"),
  lead: plainLine(FIELD_LIMITS.documentLead, "Lead"),
  premiseParagraphs: paragraphList("Premise"),
  premiseQuote: plainLine(FIELD_LIMITS.documentQuote, "Premise quote"),
  principles: claimList("principle"),
  buildPhases: phaseList("phase"),
  instruments: delimitedList(
    INSTRUMENT_PARTS,
    FIELD_LIMITS.instrumentCount,
    "instrument",
  ).transform((entries) => entries.map((entry) => ({ label: entry.label, value: entry.value }))),
  instrumentsNote: plainLine(FIELD_LIMITS.documentNote, "Instruments note"),
  stack: chipList(FIELD_LIMITS.stackItem, FIELD_LIMITS.stackCount, "stack item"),
  stackNote: plainLine(FIELD_LIMITS.documentNote, "Stack note"),
  closingTitle: plainLine(FIELD_LIMITS.documentClosingTitle, "Closing title"),
  closingLead: plainLine(FIELD_LIMITS.documentClosingLead, "Closing lead"),
  careersInvite: plainLine(FIELD_LIMITS.documentInvite, "Careers link"),
});

export const careersSchema = z.object({
  eyebrow: plainLine(FIELD_LIMITS.documentEyebrow, "Eyebrow"),
  titleLine1: plainLine(FIELD_LIMITS.documentTitleLine, "First title line"),
  titleLine2: plainLine(FIELD_LIMITS.documentTitleLine, "Second title line"),
  lead: plainLine(FIELD_LIMITS.documentLead, "Lead"),
  workingHere: claimList("claim"),
  hiringPhases: phaseList("phase"),
  // Required even though roles are usually present: this is what section 02 says when the list
  // is empty, and an empty list is a state the page is designed to stand in.
  rolesEmptyLine: plainLine(FIELD_LIMITS.rolesEmptyLine, "Empty-roles line"),
  rolesEmptyInvite: plainLine(FIELD_LIMITS.rolesEmptyInvite, "Empty-roles link"),
  openApplicationTitle: plainLine(FIELD_LIMITS.openApplicationTitle, "Open application title"),
  openApplicationLead: plainLine(FIELD_LIMITS.openApplicationLead, "Open application lead"),
  openApplicationSubject: plainLine(
    FIELD_LIMITS.openApplicationSubject,
    "Open application subject",
  ),
  openApplicationSeed: plainLine(FIELD_LIMITS.applicationSeed, "Open application seed"),
  commitmentLabel: plainLine(FIELD_LIMITS.applicationLabel, "Commitment label"),
  commitmentOptions: chipList(
    FIELD_LIMITS.commitmentOption,
    FIELD_LIMITS.commitmentCount,
    "commitment option",
  ),
  applicationBriefLabel: plainLine(FIELD_LIMITS.applicationLabel, "Brief field label"),
  applicationSubmitLabel: plainLine(FIELD_LIMITS.applicationSubmitLabel, "Submit label"),
  aboutInvite: plainLine(FIELD_LIMITS.documentInvite, "About link"),
});

export const careerRoleSchema = z.object({
  title: plainLine(FIELD_LIMITS.roleTitle, "Title"),
  location: plainLine(FIELD_LIMITS.roleLocation, "Location"),
  commitment: plainLine(FIELD_LIMITS.roleCommitment, "Commitment"),
  owns: lineList(FIELD_LIMITS.roleBullet, FIELD_LIMITS.roleBulletCount, "responsibility", true),
  needs: lineList(FIELD_LIMITS.roleBullet, FIELD_LIMITS.roleBulletCount, "requirement", true),
  // The one list that may be empty. A "nice to have" list is optional by definition, and the
  // site labels it as genuinely optional because padded ones are why good people don't apply.
  bonus: lineList(FIELD_LIMITS.roleBullet, FIELD_LIMITS.roleBulletCount, "bonus", false),
  briefSeed: plainLine(FIELD_LIMITS.applicationSeed, "Brief seed"),
});

/** The `{project}` placeholder both works-field templates must keep. */
const PROJECT_PLACEHOLDER = "{project}";

const referenceTemplate = (max: number, label: string) =>
  plainLine(max, label).refine((value) => value.includes(PROJECT_PLACEHOLDER), {
    message: `${label} must contain ${PROJECT_PLACEHOLDER} — that is where the project's name goes.`,
  });

export const enquiryFormSchema = z.object({
  nameLabel: plainLine(FIELD_LIMITS.enquiryFieldLabel, "Name label"),
  emailLabel: plainLine(FIELD_LIMITS.enquiryFieldLabel, "Email label"),
  phoneLabel: plainLine(FIELD_LIMITS.enquiryFieldLabel, "Phone label"),
  sendingLabel: plainLine(FIELD_LIMITS.enquirySendingLabel, "Sending label"),
  sentMessage: plainLine(FIELD_LIMITS.enquiryMessage, "Sent message"),
  errorMessage: plainLine(FIELD_LIMITS.enquiryMessage, "Failed message"),
  referenceSubjectSuffix: referenceTemplate(
    FIELD_LIMITS.referenceSubjectSuffix,
    "Subject suffix",
  ),
  referenceBriefPrefix: referenceTemplate(FIELD_LIMITS.referenceBriefPrefix, "Brief prefix"),
});

export const disciplineSchema = z.object({
  label: plainLine(FIELD_LIMITS.disciplineLabel, "Label"),
  briefSeed: plainLine(FIELD_LIMITS.disciplineBriefSeed, "Brief seed"),
});

/**
 * A submission of the site's enquiry form.
 *
 * One of two schemas that parse input from outside the panel, so the caller is not a trusted
 * admin — every field is length-capped and stripped of HTML before it reaches the database or an
 * admin's screen. Nothing here creates a Contact; it creates a row in the inbox.
 */
export const submissionIntakeSchema = z.object({
  /**
   * ⚠ OPTIONAL, and it is the site's form that decides that, not a relaxation of standards here.
   * That form requires exactly one field — the address to reply to — because a required-field wall
   * in front of a first message costs more conversations than a tidier inbox is worth. This schema
   * has to accept what that form is allowed to send, or the endpoint rejects a path the site
   * openly offers and the visitor is told "that did not send".
   */
  name: optionalPlainLine(FIELD_LIMITS.leadName, "Name"),
  email: emailField(FIELD_LIMITS.leadEmail, "Email"),
  company: optionalPlainLine(FIELD_LIMITS.leadCompany, "Company"),
  /** ⚠ Optional for the same reason as `name` — see above. */
  message: optionalPlainLine(FIELD_LIMITS.leadMessage, "Message"),
  phone: optionalPlainLine(FIELD_LIMITS.applicationPhone, "Phone"),
  source: optionalPlainLine(FIELD_LIMITS.leadSource, "Source"),
});

/** A link the site sends us. Same scheme rules as the footer's, minus `mailto:` and `tel:`. */
const applicationLink = (label: string) =>
  z
    .string()
    .transform(toPlainLine)
    .refine((value) => value.length <= FIELD_LIMITS.applicationLink, {
      message: `${label} must be ${FIELD_LIMITS.applicationLink} characters or fewer.`,
    })
    .refine((value) => value.length === 0 || /^https?:\/\//i.test(value), {
      message: `${label} must start with https:// or http://.`,
    })
    .optional();

/**
 * A job application.
 *
 * The other unauthenticated schema. The CV is a URL, not a file: the site uploads to UploadThing
 * and sends us what it gets back, so nothing binary reaches this app.
 *
 * ⚠ `workLink` and `cvUrl` are individually optional and jointly required — the site's form
 * enforces "a link and/or a CV, at least one" and this is the server-side half of that. An
 * application with neither is a person who has told us nothing we can act on.
 */
export const applicationIntakeSchema = z
  .object({
    name: plainLine(FIELD_LIMITS.leadName, "Name"),
    email: emailField(FIELD_LIMITS.leadEmail, "Email"),
    phone: z
      .string()
      .transform(toPlainLine)
      .refine((value) => value.length <= FIELD_LIMITS.applicationPhone, {
        message: `Phone must be ${FIELD_LIMITS.applicationPhone} characters or fewer.`,
      })
      .optional(),
    whyYou: z
      .string()
      .transform(toPlainLine)
      .refine((value) => value.length > 0, { message: "Tell us why you." })
      .refine((value) => value.length <= FIELD_LIMITS.leadMessage, {
        message: `That must be ${FIELD_LIMITS.leadMessage} characters or fewer.`,
      }),
    workLink: applicationLink("Work link"),
    cvUrl: applicationLink("CV link"),
    // Absent for an open application. Checked against the roles that exist by the route, which
    // is the only place that can know.
    roleSlug: z
      .string()
      .transform(toPlainLine)
      .refine((value) => value.length <= 64, { message: "Role is not a valid choice." })
      .optional(),
    commitment: z
      .string()
      .transform(toPlainLine)
      .refine((value) => value.length <= FIELD_LIMITS.commitmentOption, {
        message: "Commitment is too long.",
      })
      .optional(),
  })
  .refine((value) => Boolean(value.workLink?.length) || Boolean(value.cvUrl?.length), {
    message: "Send a link to your work, a CV, or both.",
    path: ["workLink"],
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
export type AboutInput = z.infer<typeof aboutSchema>;
export type CareersInput = z.infer<typeof careersSchema>;
export type CareerRoleInput = z.infer<typeof careerRoleSchema>;
export type EnquiryFormInput = z.infer<typeof enquiryFormSchema>;
export type DisciplineInput = z.infer<typeof disciplineSchema>;
export type SubmissionIntakeInput = z.infer<typeof submissionIntakeSchema>;
export type ApplicationIntakeInput = z.infer<typeof applicationIntakeSchema>;

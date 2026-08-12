import type { CareerRoleBulletKind } from "@/generated/prisma/enums";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";
import { isExternalLinkUrl } from "@/lib/validation/contentSchemas";

// The published payload is shaped to drop straight into the site's existing TypeScript
// types, minus everything the CMS deliberately does not own (model paths, hull profiles,
// per-ship lights, rock geometry, placement). Those stay in the site's source files, which
// is why a service here has no `modelPath` and a project has no `rock`.
//
// `index` is derived from array position and formatted here rather than stored, so it can
// never drift out of step with the order or leave a gap when something is deleted.

export interface PublishedService {
  index: string;
  name: string;
  eyebrow: string;
  description: string;
  capabilities: string[];
  /// The site's `DisciplineId` — what this craft's CTA enquires about.
  discipline: string;
}

export interface PublishedProject {
  index: string;
  title: string;
  client: string;
  year: string;
  description: string;
  tags: string[];
  /// The site's `DisciplineId`. Renders as the project's type key and decides its CTA.
  discipline: string;
}

/**
 * One discipline, in the shape of the site's `DISCIPLINES` record.
 *
 * Published as a list rather than a keyed object because order is meaningful here and a JSON
 * object's key order is not something to depend on. The site can index it by `key`.
 */
export interface PublishedDiscipline {
  key: string;
  label: string;
  briefSeed: string;
}

/** Every string the site's shared enquiry form renders, minus the per-section overrides. */
export interface PublishedEnquiryForm {
  nameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  sendingLabel: string;
  sentMessage: string;
  errorMessage: string;
  /// Both carry a `{project}` placeholder the site substitutes. Validated on save, so a
  /// published template always has one.
  referenceSubjectSuffix: string;
  referenceBriefPrefix: string;
}

export interface PublishedFaqEntry {
  index: string;
  question: string;
  answer: string[];
}

/**
 * The contact section's copy.
 *
 * ⚠ `title` is ONE string. The site's `CONTACT_TITLE` is not split across two lines the way the
 * other section titles are, and this payload used to carry `titleLine1`/`titleLine2` for a
 * section that did not exist yet. It also used to carry an eyebrow, a standalone email address
 * and six form strings, none of which the built section reads.
 */
export interface PublishedContact {
  title: string;
  lead: string;
  briefLabel: string;
  submitLabel: string;
}

/**
 * A claim and the thing that backs it up — the site's `Claim`, shared by About's principles
 * and Careers' "what it is like here". `index` is derived from position, like every other
 * ordinal in this payload.
 */
export interface PublishedClaim {
  index: string;
  claim: string;
  backing: string;
}

/** The site's `Phase`. No index — the track draws its own progression. */
export interface PublishedPhase {
  span: string;
  name: string;
  detail: string;
}

export interface PublishedInstrument {
  label: string;
  value: string;
}

export interface PublishedAbout {
  eyebrow: string;
  /// One entry per sentence, never one string with a line break in it — the site's masthead
  /// renders each as its own line.
  title: string[];
  lead: string;
  premiseParagraphs: string[];
  premiseQuote: string;
  principles: PublishedClaim[];
  buildPhases: PublishedPhase[];
  instruments: PublishedInstrument[];
  instrumentsNote: string;
  stack: string[];
  stackNote: string;
  closingTitle: string;
  closingLead: string;
  careersInvite: string;
}

export interface PublishedCareerRole {
  index: string;
  /**
   * ⚠ Load-bearing, and it was missing until the site was wired up. `/api/applications` matches an
   * arriving application to a role by `roleSlug` — so without the slug in the payload the site had
   * nothing to send, every application filed itself as an open one, and the inbox would have shown
   * a stack of candidates for no particular job. The index and the title are display; this is the
   * identity, and it is the only field here that survives an editor retitling the role.
   */
  slug: string;
  title: string;
  location: string;
  commitment: string;
  owns: string[];
  needs: string[];
  bonus: string[];
  briefSeed: string;
}

export interface PublishedCareers {
  eyebrow: string;
  title: string[];
  lead: string;
  workingHere: PublishedClaim[];
  /// May legitimately be empty — the page renders `rolesEmptyLine` instead, which is a
  /// designed state rather than a missing one.
  roles: PublishedCareerRole[];
  rolesEmptyLine: string;
  rolesEmptyInvite: string;
  hiringPhases: PublishedPhase[];
  openApplicationTitle: string;
  openApplicationLead: string;
  openApplicationSubject: string;
  openApplicationSeed: string;
  commitmentLabel: string;
  commitmentOptions: string[];
  applicationBriefLabel: string;
  applicationSubmitLabel: string;
  aboutInvite: string;
}

/**
 * One footer destination, shaped as the site's `ContactFooterLink`.
 *
 * `external` is always written, rather than omitted when false as the site's hand-maintained
 * array does. The site's type has it optional so both are assignable, and a payload read by code
 * is better off with no "missing or false?" question in it.
 */
export interface PublishedFooterLink {
  label: string;
  href: string;
  external: boolean;
}

export interface PublishedFooterGroup {
  title: string;
  links: PublishedFooterLink[];
}

export interface PublishedFooter {
  tagline: string;
  signOff: string;
  /// ⚠ One list, two footers — the homepage's contact section and the document pages both
  /// render this. See the schema note on FooterLinkGroup.
  groups: PublishedFooterGroup[];
}

export interface ContentPayload {
  services: PublishedService[];
  projects: PublishedProject[];
  faq: PublishedFaqEntry[];
  /// Null until someone saves the section for the first time. The site should treat a null
  /// here as "this section isn't ready" rather than rendering empty strings.
  contact: PublishedContact | null;
  footer: PublishedFooter | null;
  about: PublishedAbout | null;
  careers: PublishedCareers | null;
  /// The vocabulary services, works and the enquiry form all key off. Always present — the four
  /// rows are seeded by migration, not created by an editor.
  disciplines: PublishedDiscipline[];
  enquiryForm: PublishedEnquiryForm | null;
}

export function formatOrdinal(position: number): string {
  return String(position + 1).padStart(2, "0");
}

/**
 * A seed the applicant types straight onto the end of.
 *
 * These are deliberately left mid-sentence ("…what I would want to own: "), so the trailing
 * space is load-bearing — without it the applicant's first word joins the last one. Every
 * string in this CMS is trimmed on save by `toPlainLine`, which is right for all of them and
 * would silently eat this one, so the space is added back here rather than asked of the editor.
 *
 * Structural, not typed: an invisible character nobody can see in a text field is not something
 * to make an editor remember, and the counter would disagree about it too.
 */
function continuationSeed(value: string): string {
  return value.length > 0 ? `${value} ` : value;
}

/**
 * Reads the draft tables and returns them in published shape. This is what the Publish
 * button snapshots, and also what the dashboard compares against the last release to work
 * out whether anything is actually waiting to go out.
 */
export async function buildContentPayload(): Promise<ContentPayload> {
  const [
    services,
    projects,
    faqEntries,
    contact,
    footer,
    linkGroups,
    about,
    premiseParagraphs,
    principles,
    buildPhases,
    instruments,
    stackItems,
    careers,
    workingHere,
    hiringPhases,
    commitmentOptions,
    roles,
    disciplines,
    enquiryForm,
  ] = await Promise.all([
    prisma.service.findMany({
      orderBy: { sortOrder: "asc" },
      include: { capabilities: { orderBy: { sortOrder: "asc" } }, discipline: true },
    }),
    prisma.project.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tags: { orderBy: { sortOrder: "asc" } }, discipline: true },
    }),
    prisma.faqEntry.findMany({
      orderBy: { sortOrder: "asc" },
      include: { paragraphs: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.contactSection.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.footerContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.footerLinkGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: { links: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.aboutPage.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.aboutPremiseParagraph.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.aboutPrinciple.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.aboutBuildPhase.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.aboutInstrument.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.aboutStackItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careersPage.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.careersClaim.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careersHiringPhase.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careersCommitmentOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careerRole.findMany({
      orderBy: { sortOrder: "asc" },
      include: { bullets: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.discipline.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.enquiryFormContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
  ]);

  return {
    services: services.map((service, position) => ({
      index: formatOrdinal(position),
      name: service.name,
      eyebrow: service.eyebrow,
      description: service.description,
      capabilities: service.capabilities.map((capability) => capability.label),
      discipline: service.discipline.key,
    })),
    projects: projects.map((project, position) => ({
      index: formatOrdinal(position),
      title: project.title,
      client: project.client,
      year: project.year,
      description: project.description,
      tags: project.tags.map((tag) => tag.label),
      discipline: project.discipline.key,
    })),
    faq: faqEntries.map((entry, position) => ({
      index: formatOrdinal(position),
      question: entry.question,
      answer: entry.paragraphs.map((paragraph) => paragraph.body),
    })),
    contact: contact
      ? {
          title: contact.title,
          lead: contact.lead,
          briefLabel: contact.briefLabel,
          submitLabel: contact.submitLabel,
        }
      : null,
    footer: footer
      ? {
          tagline: footer.tagline,
          signOff: footer.signOff,
          groups: linkGroups.map((group) => ({
            title: group.title,
            links: group.links.map((link) => ({
              label: link.label,
              href: link.href,
              external: isExternalLinkUrl(link.href),
            })),
          })),
        }
      : null,
    about: about
      ? {
          eyebrow: about.eyebrow,
          title: [about.titleLine1, about.titleLine2],
          lead: about.lead,
          premiseParagraphs: premiseParagraphs.map((paragraph) => paragraph.body),
          premiseQuote: about.premiseQuote,
          principles: principles.map(toPublishedClaim),
          buildPhases: buildPhases.map(toPublishedPhase),
          instruments: instruments.map((instrument) => ({
            label: instrument.label,
            value: instrument.value,
          })),
          instrumentsNote: about.instrumentsNote,
          stack: stackItems.map((item) => item.label),
          stackNote: about.stackNote,
          closingTitle: about.closingTitle,
          closingLead: about.closingLead,
          careersInvite: about.careersInvite,
        }
      : null,
    careers: careers
      ? {
          eyebrow: careers.eyebrow,
          title: [careers.titleLine1, careers.titleLine2],
          lead: careers.lead,
          workingHere: workingHere.map(toPublishedClaim),
          roles: roles.map((role, position) => ({
            index: formatOrdinal(position),
            slug: role.slug,
            title: role.title,
            location: role.location,
            commitment: role.commitment,
            owns: bulletsOfKind(role.bullets, "OWNS"),
            needs: bulletsOfKind(role.bullets, "NEEDS"),
            bonus: bulletsOfKind(role.bullets, "BONUS"),
            briefSeed: continuationSeed(role.briefSeed),
          })),
          rolesEmptyLine: careers.rolesEmptyLine,
          rolesEmptyInvite: careers.rolesEmptyInvite,
          hiringPhases: hiringPhases.map(toPublishedPhase),
          openApplicationTitle: careers.openApplicationTitle,
          openApplicationLead: careers.openApplicationLead,
          openApplicationSubject: careers.openApplicationSubject,
          openApplicationSeed: continuationSeed(careers.openApplicationSeed),
          commitmentLabel: careers.commitmentLabel,
          commitmentOptions: commitmentOptions.map((option) => option.label),
          applicationBriefLabel: careers.applicationBriefLabel,
          applicationSubmitLabel: careers.applicationSubmitLabel,
          aboutInvite: careers.aboutInvite,
        }
      : null,
    disciplines: disciplines.map((discipline) => ({
      key: discipline.key,
      label: discipline.label,
      // Continued by the visitor, exactly like the careers seeds — same reasoning, same helper.
      briefSeed: continuationSeed(discipline.briefSeed),
    })),
    enquiryForm: enquiryForm
      ? {
          nameLabel: enquiryForm.nameLabel,
          emailLabel: enquiryForm.emailLabel,
          phoneLabel: enquiryForm.phoneLabel,
          sendingLabel: enquiryForm.sendingLabel,
          sentMessage: enquiryForm.sentMessage,
          errorMessage: enquiryForm.errorMessage,
          referenceSubjectSuffix: enquiryForm.referenceSubjectSuffix,
          referenceBriefPrefix: enquiryForm.referenceBriefPrefix,
        }
      : null,
  };
}

function toPublishedClaim(
  row: { claim: string; backing: string },
  position: number,
): PublishedClaim {
  return { index: formatOrdinal(position), claim: row.claim, backing: row.backing };
}

function toPublishedPhase(row: { span: string; name: string; detail: string }): PublishedPhase {
  return { span: row.span, name: row.name, detail: row.detail };
}

// The three lists come back as one ordered query and are split here, so each keeps its own
// contiguous order without three round trips.
function bulletsOfKind(
  bullets: { kind: CareerRoleBulletKind; label: string }[],
  kind: CareerRoleBulletKind,
): string[] {
  return bullets.filter((bullet) => bullet.kind === kind).map((bullet) => bullet.label);
}

export interface SectionChangeSummary {
  services: boolean;
  projects: boolean;
  faq: boolean;
  contact: boolean;
  footer: boolean;
  about: boolean;
  careers: boolean;
  enquiryForm: boolean;
}

export interface DraftStatus {
  hasUnpublishedChanges: boolean;
  changedSections: SectionChangeSummary;
  neverPublished: boolean;
}

/**
 * Whether the draft differs from the last release, and in which sections.
 *
 * Compares serialised JSON rather than timestamps on purpose: editing a field and then
 * typing the original value back should leave you with nothing to publish, and an
 * `updatedAt` check would insist otherwise.
 */
export function compareWithRelease(
  draft: ContentPayload,
  release: ContentPayload | null,
): DraftStatus {
  if (!release) {
    return {
      hasUnpublishedChanges: true,
      changedSections: {
        services: true,
        projects: true,
        faq: true,
        contact: true,
        footer: true,
        about: true,
        careers: true,
        enquiryForm: true,
      },
      neverPublished: true,
    };
  }

  const changedSections: SectionChangeSummary = {
    services: !isDeepEqual(draft.services, release.services),
    projects: !isDeepEqual(draft.projects, release.projects),
    faq: !isDeepEqual(draft.faq, release.faq),
    // `?? null` because releases published before these sections existed have no key at all,
    // and `undefined` vs `null` would otherwise read as a change on every comparison forever.
    contact: !isDeepEqual(draft.contact, release.contact ?? null),
    footer: !isDeepEqual(draft.footer, release.footer ?? null),
    about: !isDeepEqual(draft.about, release.about ?? null),
    careers: !isDeepEqual(draft.careers, release.careers ?? null),
    // One badge covers both, because one page edits both: the form's strings and the four
    // discipline prefills are the same editing job and splitting them would report a change the
    // editor cannot act on separately.
    enquiryForm:
      !isDeepEqual(draft.enquiryForm, release.enquiryForm ?? null) ||
      !isDeepEqual(draft.disciplines, release.disciplines ?? []),
  };

  return {
    hasUnpublishedChanges: Object.values(changedSections).some((hasChanged) => hasChanged),
    changedSections,
    neverPublished: false,
  };
}

// Safe here because every payload value is a string, an array or a plain object built by
// buildContentPayload — no dates, no undefined, and key order is fixed by the mapping above.
function isDeepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Narrows the `Json` column back to a payload. Releases are only ever written by
 * `buildContentPayload`, so this checks the shape rather than validating every field.
 */
export function parseReleasePayload(payload: unknown): ContentPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<ContentPayload>;

  if (
    !Array.isArray(candidate.services) ||
    !Array.isArray(candidate.projects) ||
    !Array.isArray(candidate.faq)
  ) {
    return null;
  }

  return {
    services: candidate.services,
    projects: candidate.projects,
    faq: candidate.faq,
    // Releases published before Contact, Footer, About and Careers existed simply don't carry
    // these keys.
    contact: candidate.contact ?? null,
    footer: candidate.footer ?? null,
    about: candidate.about ?? null,
    careers: candidate.careers ?? null,
    // `[]` rather than null: disciplines are seeded by migration and always exist going forward,
    // so an older release simply had none recorded.
    disciplines: candidate.disciplines ?? [],
    enquiryForm: candidate.enquiryForm ?? null,
  };
}

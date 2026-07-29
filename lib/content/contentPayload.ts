import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

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
}

export interface PublishedProject {
  index: string;
  title: string;
  client: string;
  year: string;
  description: string;
  tags: string[];
}

export interface PublishedFaqEntry {
  index: string;
  question: string;
  answer: string[];
}

export interface PublishedContact {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  emailAddress: string;
  formNameLabel: string;
  formEmailLabel: string;
  formMessageLabel: string;
  submitLabel: string;
  successMessage: string;
  errorMessage: string;
}

export interface PublishedLink {
  label: string;
  url: string;
}

export interface PublishedFooter {
  tagline: string;
  copyright: string;
  socialLinks: PublishedLink[];
  legalLinks: PublishedLink[];
}

export interface ContentPayload {
  services: PublishedService[];
  projects: PublishedProject[];
  faq: PublishedFaqEntry[];
  /// Null until someone saves the section for the first time. The site should treat a null
  /// here as "this section isn't ready" rather than rendering empty strings.
  contact: PublishedContact | null;
  footer: PublishedFooter | null;
}

export function formatOrdinal(position: number): string {
  return String(position + 1).padStart(2, "0");
}

/**
 * Reads the draft tables and returns them in published shape. This is what the Publish
 * button snapshots, and also what the dashboard compares against the last release to work
 * out whether anything is actually waiting to go out.
 */
export async function buildContentPayload(): Promise<ContentPayload> {
  const [services, projects, faqEntries, contact, footer, socialLinks, legalLinks] =
    await Promise.all([
      prisma.service.findMany({
        orderBy: { sortOrder: "asc" },
        include: { capabilities: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.project.findMany({
        orderBy: { sortOrder: "asc" },
        include: { tags: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.faqEntry.findMany({
        orderBy: { sortOrder: "asc" },
        include: { paragraphs: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.contactSection.findUnique({ where: { id: SINGLETON_ROW_ID } }),
      prisma.footerContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
      prisma.footerSocialLink.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.footerLegalLink.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

  return {
    services: services.map((service, position) => ({
      index: formatOrdinal(position),
      name: service.name,
      eyebrow: service.eyebrow,
      description: service.description,
      capabilities: service.capabilities.map((capability) => capability.label),
    })),
    projects: projects.map((project, position) => ({
      index: formatOrdinal(position),
      title: project.title,
      client: project.client,
      year: project.year,
      description: project.description,
      tags: project.tags.map((tag) => tag.label),
    })),
    faq: faqEntries.map((entry, position) => ({
      index: formatOrdinal(position),
      question: entry.question,
      answer: entry.paragraphs.map((paragraph) => paragraph.body),
    })),
    contact: contact
      ? {
          eyebrow: contact.eyebrow,
          titleLine1: contact.titleLine1,
          titleLine2: contact.titleLine2,
          description: contact.description,
          emailAddress: contact.emailAddress,
          formNameLabel: contact.formNameLabel,
          formEmailLabel: contact.formEmailLabel,
          formMessageLabel: contact.formMessageLabel,
          submitLabel: contact.submitLabel,
          successMessage: contact.successMessage,
          errorMessage: contact.errorMessage,
        }
      : null,
    footer: footer
      ? {
          tagline: footer.tagline,
          copyright: footer.copyright,
          socialLinks: socialLinks.map((link) => ({ label: link.label, url: link.url })),
          legalLinks: legalLinks.map((link) => ({ label: link.label, url: link.url })),
        }
      : null,
  };
}

export interface SectionChangeSummary {
  services: boolean;
  projects: boolean;
  faq: boolean;
  contact: boolean;
  footer: boolean;
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
    // Releases published before Contact and Footer existed simply don't carry these keys.
    contact: candidate.contact ?? null,
    footer: candidate.footer ?? null,
  };
}

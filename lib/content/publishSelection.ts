import { isDeepStrictEqual } from "node:util";

import type {
  ContentPayload,
  DraftStatus,
  PublishedBlogPost,
  SectionChangeSummary,
} from "@/lib/content/contentPayload";

export type PublishSection = keyof SectionChangeSummary;

export interface PublishSelection {
  sections: PublishSection[];
  blogSlugs: string[];
}

export interface SelectableBlogChange {
  slug: string;
  title: string;
  state: "new" | "changed";
}

export const PUBLISH_SECTIONS = [
  "services",
  "projects",
  "faq",
  "contact",
  "footer",
  "about",
  "careers",
  "blogs",
  "enquiryForm",
] as const satisfies readonly PublishSection[];

const PUBLISH_SECTION_SET = new Set<string>(PUBLISH_SECTIONS);

export function isPublishSection(value: string): value is PublishSection {
  return PUBLISH_SECTION_SET.has(value);
}

/**
 * Compares payload values rather than their serialised key order.
 *
 * PostgreSQL JSONB normalises object keys when a release is stored. `JSON.stringify` therefore
 * produces different strings for a draft and its own release even when every value is identical.
 */
export function compareContentWithRelease(
  draft: ContentPayload,
  release: ContentPayload | null,
): DraftStatus {
  if (!release) {
    return {
      hasUnpublishedChanges: true,
      changedSections: Object.fromEntries(
        PUBLISH_SECTIONS.map((section) => [section, true]),
      ) as unknown as SectionChangeSummary,
      neverPublished: true,
    };
  }

  const changedSections: SectionChangeSummary = {
    services: !isDeepStrictEqual(draft.services, release.services),
    projects: !isDeepStrictEqual(draft.projects, release.projects),
    faq: !isDeepStrictEqual(draft.faq, release.faq),
    contact: !isDeepStrictEqual(draft.contact, release.contact ?? null),
    footer: !isDeepStrictEqual(draft.footer, release.footer ?? null),
    about: !isDeepStrictEqual(draft.about, release.about ?? null),
    careers: !isDeepStrictEqual(draft.careers, release.careers ?? null),
    blogs: !isDeepStrictEqual(draft.blogs, release.blogs ?? []),
    enquiryForm:
      !isDeepStrictEqual(draft.enquiryForm, release.enquiryForm ?? null) ||
      !isDeepStrictEqual(draft.disciplines, release.disciplines ?? []),
  };

  return {
    hasUnpublishedChanges: Object.values(changedSections).some(Boolean),
    changedSections,
    neverPublished: false,
  };
}

/**
 * Resolves the submitted controls against the current draft state.
 *
 * The UI disables published sections, but this server-side gate keeps a stale or hand-crafted
 * request from creating a release for content that has no draft change. "Publish all" deliberately
 * means every changed section, not every key in the payload.
 */
export function resolvePublishSelection(
  changedSections: SectionChangeSummary,
  selectableBlogSlugs: string[],
  requested: PublishSelection,
  publishAll: boolean,
): PublishSelection {
  if (publishAll) {
    const sections = PUBLISH_SECTIONS.filter((section) => changedSections[section]);

    if (sections.length === 0) {
      throw new Error("There are no unpublished changes to publish.");
    }

    return { sections: [...sections], blogSlugs: [] };
  }

  const sections = [...new Set(requested.sections)];

  for (const section of sections) {
    if (!changedSections[section]) {
      throw new Error(`${section} has no unpublished changes to publish.`);
    }
  }

  const selectableSlugs = new Set(selectableBlogSlugs);
  const blogSlugs = sections.includes("blogs") ? [] : [...new Set(requested.blogSlugs)];

  for (const slug of blogSlugs) {
    if (!selectableSlugs.has(slug)) {
      throw new Error(`The blog article "${slug}" has no unpublished changes to publish.`);
    }
  }

  if (sections.length === 0 && blogSlugs.length === 0) {
    throw new Error("Select at least one section or blog article to publish.");
  }

  return { sections, blogSlugs };
}

export function createEmptyContentPayload(): ContentPayload {
  return {
    services: [],
    projects: [],
    faq: [],
    contact: null,
    footer: null,
    about: null,
    careers: null,
    blogs: [],
    disciplines: [],
    enquiryForm: null,
  };
}

export function mergeSelectedContent(
  draft: ContentPayload,
  release: ContentPayload | null,
  selection: PublishSelection,
): ContentPayload {
  const sections = new Set(selection.sections);
  const blogSlugs = [...new Set(selection.blogSlugs)];

  if (sections.size === 0 && blogSlugs.length === 0) {
    throw new Error("Select at least one section or blog article to publish.");
  }

  const payload: ContentPayload = release
    ? {
        ...release,
        // Keep list references isolated from the source release. This is not strictly needed for
        // JSON serialisation, but prevents a later merge step from mutating the parsed snapshot.
        services: [...release.services],
        projects: [...release.projects],
        faq: [...release.faq],
        blogs: [...release.blogs],
        disciplines: [...release.disciplines],
      }
    : createEmptyContentPayload();

  if (sections.has("services")) payload.services = draft.services;
  if (sections.has("projects")) payload.projects = draft.projects;
  if (sections.has("faq")) payload.faq = draft.faq;
  if (sections.has("contact")) payload.contact = draft.contact;
  if (sections.has("footer")) payload.footer = draft.footer;
  if (sections.has("about")) payload.about = draft.about;
  if (sections.has("careers")) payload.careers = draft.careers;

  if (sections.has("enquiryForm")) {
    payload.enquiryForm = draft.enquiryForm;
    payload.disciplines = draft.disciplines;
  }

  if (sections.has("blogs")) {
    payload.blogs = reindexBlogs(draft.blogs);
  } else if (blogSlugs.length > 0) {
    payload.blogs = mergeSelectedBlogs(draft.blogs, payload.blogs, blogSlugs);
  }

  return payload;
}

export function getSelectableBlogChanges(
  draft: PublishedBlogPost[],
  release: PublishedBlogPost[],
): SelectableBlogChange[] {
  const releasedBySlug = new Map(release.map((post) => [post.slug, post]));
  const changes: SelectableBlogChange[] = [];

  for (const post of draft) {
    const released = releasedBySlug.get(post.slug);

    if (!released) {
      changes.push({ slug: post.slug, title: post.title, state: "new" });
      continue;
    }

    if (!isSameBlogContent(post, released)) {
      changes.push({ slug: post.slug, title: post.title, state: "changed" });
    }
  }

  return changes;
}

function mergeSelectedBlogs(
  draft: PublishedBlogPost[],
  release: PublishedBlogPost[],
  selectedSlugs: string[],
): PublishedBlogPost[] {
  const selected = new Set(selectedSlugs);
  const draftBySlug = new Map(draft.map((post) => [post.slug, post]));

  for (const slug of selected) {
    if (!draftBySlug.has(slug)) {
      throw new Error(`Selected blog article "${slug}" does not exist in the draft.`);
    }
  }

  const releasedSlugs = new Set(release.map((post) => post.slug));
  const merged = release.map((post) =>
    selected.has(post.slug) ? (draftBySlug.get(post.slug) ?? post) : post,
  );

  for (const post of draft) {
    if (selected.has(post.slug) && !releasedSlugs.has(post.slug)) {
      merged.push(post);
    }
  }

  return reindexBlogs(merged);
}

function reindexBlogs(blogs: PublishedBlogPost[]): PublishedBlogPost[] {
  return blogs.map((post, position) => ({
    ...post,
    index: String(position + 1).padStart(2, "0"),
  }));
}

function isSameBlogContent(left: PublishedBlogPost, right: PublishedBlogPost): boolean {
  const leftContent = {
    slug: left.slug,
    title: left.title,
    seoTitle: left.seoTitle,
    excerpt: left.excerpt,
    category: left.category,
    publishedOn: left.publishedOn,
    body: left.body,
  };
  const rightContent = {
    slug: right.slug,
    title: right.title,
    seoTitle: right.seoTitle,
    excerpt: right.excerpt,
    category: right.category,
    publishedOn: right.publishedOn,
    body: right.body,
  };
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
}

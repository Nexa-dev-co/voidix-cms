import assert from "node:assert/strict";
import test from "node:test";

import type { ContentPayload, PublishedBlogPost } from "../lib/content/contentPayload";
import * as publishSelectionModule from "../lib/content/publishSelection";
import type { PublishSelection } from "../lib/content/publishSelection";

type SelectivePublishHelpers = {
  mergeSelectedContent: (
    draft: ContentPayload,
    release: ContentPayload | null,
    selection: PublishSelection,
  ) => ContentPayload;
  getSelectableBlogChanges: (
    draft: PublishedBlogPost[],
    release: PublishedBlogPost[],
  ) => { slug: string; title: string; state: "new" | "changed" }[];
};

const helpers = publishSelectionModule as unknown as Partial<SelectivePublishHelpers>;

function emptyPayload(overrides: Partial<ContentPayload> = {}): ContentPayload {
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
    ...overrides,
  };
}

function blog(
  slug: string,
  title: string,
  index: string,
  body = `${title} body`,
): PublishedBlogPost {
  return {
    index,
    slug,
    title,
    seoTitle: `${title} | Voidix`,
    excerpt: `${title} excerpt`,
    category: "Strategy",
    publishedOn: "2026-09-22",
    body: [{ kind: "PARAGRAPH", body }],
  };
}

test("exports the selective publishing helpers", () => {
  assert.equal(typeof helpers.mergeSelectedContent, "function");
  assert.equal(typeof helpers.getSelectableBlogChanges, "function");
});

test("publishes a selected section while preserving every unselected section", () => {
  assert.ok(helpers.mergeSelectedContent);

  const releasedContact = { title: "Old", lead: "Old", briefLabel: "Brief", submitLabel: "Send" };
  const draftContact = { title: "New", lead: "New", briefLabel: "Brief", submitLabel: "Send" };
  const released = emptyPayload({
    contact: releasedContact,
    services: [
      {
        index: "01",
        name: "Released service",
        eyebrow: "Released",
        description: "Keep me",
        capabilities: [],
        discipline: "brand",
      },
    ],
  });
  const draft = emptyPayload({ contact: draftContact });

  const merged = helpers.mergeSelectedContent(draft, released, {
    sections: ["contact"],
    blogSlugs: [],
  });

  assert.deepEqual(merged.contact, draftContact);
  assert.deepEqual(merged.services, released.services);
});

test("publishing the enquiry form also publishes its discipline vocabulary", () => {
  assert.ok(helpers.mergeSelectedContent);

  const released = emptyPayload({
    disciplines: [{ key: "old", label: "Old", briefSeed: "Old " }],
  });
  const draft = emptyPayload({
    disciplines: [{ key: "new", label: "New", briefSeed: "New " }],
    enquiryForm: {
      nameLabel: "Name",
      emailLabel: "Email",
      phoneLabel: "Phone",
      sendingLabel: "Sending",
      sentMessage: "Sent",
      errorMessage: "Error",
      referenceSubjectSuffix: "{project}",
      referenceBriefPrefix: "{project}",
    },
  });

  const merged = helpers.mergeSelectedContent(draft, released, {
    sections: ["enquiryForm"],
    blogSlugs: [],
  });

  assert.deepEqual(merged.enquiryForm, draft.enquiryForm);
  assert.deepEqual(merged.disciplines, draft.disciplines);
});

test("publishing the whole blog applies additions, deletions, and ordering", () => {
  assert.ok(helpers.mergeSelectedContent);

  const released = emptyPayload({ blogs: [blog("one", "One", "01"), blog("two", "Two", "02")] });
  const draft = emptyPayload({ blogs: [blog("two", "Two revised", "01")] });

  const merged = helpers.mergeSelectedContent(draft, released, {
    sections: ["blogs"],
    blogSlugs: [],
  });

  assert.deepEqual(merged.blogs, [blog("two", "Two revised", "01")]);
});

test("publishing individual articles changes only those articles", () => {
  assert.ok(helpers.mergeSelectedContent);

  const released = emptyPayload({
    blogs: [blog("one", "One", "01"), blog("two", "Two", "02")],
  });
  const draft = emptyPayload({
    blogs: [
      blog("two", "Two revised", "01"),
      blog("one", "One draft only", "02"),
      blog("three", "Three", "03"),
    ],
  });

  const merged = helpers.mergeSelectedContent(draft, released, {
    sections: [],
    blogSlugs: ["two", "three"],
  });

  assert.deepEqual(merged.blogs, [
    blog("one", "One", "01"),
    blog("two", "Two revised", "02"),
    blog("three", "Three", "03"),
  ]);
});

test("an article-only first release starts with safe empty sections", () => {
  assert.ok(helpers.mergeSelectedContent);

  const draft = emptyPayload({ blogs: [blog("one", "One", "01"), blog("two", "Two", "02")] });
  const merged = helpers.mergeSelectedContent(draft, null, {
    sections: [],
    blogSlugs: ["two"],
  });

  assert.deepEqual(merged, emptyPayload({ blogs: [blog("two", "Two", "01")] }));
});

test("rejects an empty publishing selection", () => {
  assert.ok(helpers.mergeSelectedContent);

  assert.throws(
    () => helpers.mergeSelectedContent!(emptyPayload(), emptyPayload(), {
      sections: [],
      blogSlugs: [],
    }),
    /select/i,
  );
});

test("individual article choices ignore index-only changes", () => {
  assert.ok(helpers.getSelectableBlogChanges);

  const released = [blog("one", "One", "01"), blog("two", "Two", "02")];
  const draft = [
    blog("two", "Two", "01"),
    blog("one", "One revised", "02"),
    blog("three", "Three", "03"),
  ];

  assert.deepEqual(helpers.getSelectableBlogChanges(draft, released), [
    { slug: "one", title: "One revised", state: "changed" },
    { slug: "three", title: "Three", state: "new" },
  ]);
});

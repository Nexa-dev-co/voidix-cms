import assert from "node:assert/strict";
import test from "node:test";

import * as blogBlocks from "../lib/content/blogBlocks";
import { blogSchema } from "../lib/validation/contentSchemas";

const validPost = {
  title: "Designing for the last frame",
  seoTitle: "Designing for the last frame | Voidix",
  excerpt: "What a cinematic interface owes the person using it.",
  category: "Interaction",
  publishedOn: "2026-09-21",
  body: "The opening moment gets attention.\n\nThe final frame earns trust.",
};

test("normalises a blog post into typed content blocks", () => {
  const parsed = blogSchema.parse({
    ...validPost,
    body: [
      "## What the system changes",
      "",
      "The opening moment gets attention.",
      "",
      "- Faster handoffs",
      "- Clearer ownership",
      "",
      "### What happens next",
      "",
      "The final frame earns trust.",
    ].join("\n"),
  });

  assert.deepEqual(parsed.body, [
    { kind: "HEADING_2", body: "What the system changes" },
    { kind: "PARAGRAPH", body: "The opening moment gets attention." },
    { kind: "LIST_ITEM", body: "Faster handoffs" },
    { kind: "LIST_ITEM", body: "Clearer ownership" },
    { kind: "HEADING_3", body: "What happens next" },
    { kind: "PARAGRAPH", body: "The final frame earns trust." },
  ]);
});

test("rejects a blog post without a real publication date", () => {
  const parsed = blogSchema.safeParse({ ...validPost, publishedOn: "soon" });

  assert.equal(parsed.success, false);
});

test("serialises typed blocks back into the controlled editor syntax", () => {
  assert.equal(typeof blogBlocks.serialiseBlogBlocks, "function");

  const value = blogBlocks.serialiseBlogBlocks!([
    { kind: "HEADING_2", body: "Overview" },
    { kind: "PARAGRAPH", body: "A useful opening." },
    { kind: "LIST_ITEM", body: "First point" },
    { kind: "LIST_ITEM", body: "Second point" },
  ]);

  assert.equal(value, "## Overview\n\nA useful opening.\n\n- First point\n- Second point");
});

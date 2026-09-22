import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { serialiseBlogBlocks } from "../lib/content/blogBlocks";
import { blogSchema } from "../lib/validation/contentSchemas";

type SeedArticle = {
  sourceArticle: number;
  slug: string;
  title: string;
  seoTitle: string;
  excerpt: string;
  category: string;
  body: { kind: string; body: string }[];
};

const articles = JSON.parse(
  readFileSync(new URL("../prisma/data/blogArticles.json", import.meta.url), "utf8"),
) as SeedArticle[];

test("contains the complete ordered 30-article library", () => {
  assert.deepEqual(articles.map((article) => article.sourceArticle), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(new Set(articles.map((article) => article.slug)).size, 30);
});

test("every imported article has CMS metadata and structured body content", () => {
  const allowedKinds = new Set(["PARAGRAPH", "HEADING_2", "HEADING_3", "LIST_ITEM"]);

  for (const article of articles) {
    assert.ok(article.slug);
    assert.ok(article.title);
    assert.ok(article.seoTitle);
    assert.ok(article.excerpt);
    assert.ok(article.category);
    assert.ok(article.body.length > 0 && article.body.length <= 320);
    assert.ok(article.body.every((block) => allowedKinds.has(block.kind) && block.body.length > 0));

    const parsed = blogSchema.safeParse({
      ...article,
      publishedOn: "2026-09-22",
      body: serialiseBlogBlocks(article.body as Parameters<typeof serialiseBlogBlocks>[0]),
    });
    assert.equal(parsed.success, true, `Article ${article.sourceArticle} failed CMS validation.`);
  }
});

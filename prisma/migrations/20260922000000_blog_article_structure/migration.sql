-- Preserve the supplied articles' hierarchy without allowing arbitrary HTML or Markdown.
CREATE TYPE "BlogBlockKind" AS ENUM ('PARAGRAPH', 'HEADING_2', 'HEADING_3', 'LIST_ITEM');

ALTER TABLE "blog_posts" ADD COLUMN "seo_title" VARCHAR(160);
UPDATE "blog_posts" SET "seo_title" = "title" WHERE "seo_title" IS NULL;
ALTER TABLE "blog_posts" ALTER COLUMN "seo_title" SET NOT NULL;

ALTER TABLE "blog_paragraphs"
  ADD COLUMN "kind" "BlogBlockKind" NOT NULL DEFAULT 'PARAGRAPH';

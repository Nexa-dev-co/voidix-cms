-- CMS-owned public journal. Draft rows are published only through the existing immutable release
-- snapshot, exactly like Works and FAQ.
CREATE TABLE "blog_posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" VARCHAR(80) NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "title" VARCHAR(140) NOT NULL,
  "excerpt" VARCHAR(320) NOT NULL,
  "category" VARCHAR(60) NOT NULL,
  "published_on" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_paragraphs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "blog_post_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  CONSTRAINT "blog_paragraphs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_sort_order_idx" ON "blog_posts"("sort_order");
CREATE INDEX "blog_posts_published_on_idx" ON "blog_posts"("published_on");
CREATE INDEX "blog_paragraphs_blog_post_id_sort_order_idx"
  ON "blog_paragraphs"("blog_post_id", "sort_order");

ALTER TABLE "blog_paragraphs"
  ADD CONSTRAINT "blog_paragraphs_blog_post_id_fkey"
  FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase exposes public tables through PostgREST. Prisma connects as the owner and bypasses this;
-- browser-held anon and authenticated keys receive deny-all because no policies are created.
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blog_paragraphs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "blog_posts" FROM anon, authenticated;
REVOKE ALL ON TABLE "blog_paragraphs" FROM anon, authenticated;

-- The connected site reads this draft footer rather than its local fallback. Put the new public
-- route in the existing Studio group without assuming its UUID or disturbing hand-edited order.
INSERT INTO "footer_links" ("id", "group_id", "sort_order", "label", "href")
SELECT
  gen_random_uuid(),
  "footer_link_groups"."id",
  COALESCE((SELECT MAX("sort_order") + 1 FROM "footer_links" WHERE "group_id" = "footer_link_groups"."id"), 0),
  'Journal',
  '/blog'
FROM "footer_link_groups"
WHERE lower("title") = 'studio'
  AND NOT EXISTS (SELECT 1 FROM "footer_links" WHERE "href" = '/blog');

-- The /about and /careers document pages.
--
-- A singleton for each page's prose plus standalone ordered tables for its lists, the same
-- arrangement footer_content already uses with its two link tables. The numbered section lists
-- (ABOUT_SECTIONS / CAREERS_SECTIONS on the site) are deliberately absent: each entry's key is
-- an anchor id and an orbit-rail station, so it is structure rather than copy.

-- CreateEnum
CREATE TYPE "career_role_bullet_kind" AS ENUM ('OWNS', 'NEEDS', 'BONUS');

-- CreateTable
CREATE TABLE "about_page" (
    "id" TEXT NOT NULL,
    "eyebrow" VARCHAR(60) NOT NULL,
    "title_line_1" VARCHAR(60) NOT NULL,
    "title_line_2" VARCHAR(60) NOT NULL,
    "lead" TEXT NOT NULL,
    "premise_quote" TEXT NOT NULL,
    "instruments_note" TEXT NOT NULL,
    "stack_note" TEXT NOT NULL,
    "closing_title" VARCHAR(80) NOT NULL,
    "closing_lead" TEXT NOT NULL,
    "careers_invite" VARCHAR(120) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "about_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_premise_paragraphs" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "about_premise_paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_principles" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "claim" VARCHAR(80) NOT NULL,
    "backing" TEXT NOT NULL,

    CONSTRAINT "about_principles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_build_phases" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "span" VARCHAR(40) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "about_build_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_instruments" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "value" VARCHAR(40) NOT NULL,

    CONSTRAINT "about_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_stack_items" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,

    CONSTRAINT "about_stack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers_page" (
    "id" TEXT NOT NULL,
    "eyebrow" VARCHAR(60) NOT NULL,
    "title_line_1" VARCHAR(60) NOT NULL,
    "title_line_2" VARCHAR(60) NOT NULL,
    "lead" TEXT NOT NULL,
    "roles_empty_line" VARCHAR(200) NOT NULL,
    "roles_empty_invite" VARCHAR(60) NOT NULL,
    "open_application_title" VARCHAR(80) NOT NULL,
    "open_application_lead" TEXT NOT NULL,
    "open_application_subject" VARCHAR(60) NOT NULL,
    "open_application_seed" VARCHAR(200) NOT NULL,
    "commitment_label" VARCHAR(60) NOT NULL,
    "application_brief_label" VARCHAR(60) NOT NULL,
    "application_submit_label" VARCHAR(40) NOT NULL,
    "about_invite" VARCHAR(120) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "careers_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers_working_here" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "claim" VARCHAR(80) NOT NULL,
    "backing" TEXT NOT NULL,

    CONSTRAINT "careers_working_here_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers_hiring_phases" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "span" VARCHAR(40) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "careers_hiring_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "careers_commitment_options" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,

    CONSTRAINT "careers_commitment_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_roles" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "location" VARCHAR(60) NOT NULL,
    "commitment" VARCHAR(60) NOT NULL,
    "brief_seed" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_role_bullets" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "kind" "career_role_bullet_kind" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "career_role_bullets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "about_premise_paragraphs_sort_order_idx" ON "about_premise_paragraphs"("sort_order");

-- CreateIndex
CREATE INDEX "about_principles_sort_order_idx" ON "about_principles"("sort_order");

-- CreateIndex
CREATE INDEX "about_build_phases_sort_order_idx" ON "about_build_phases"("sort_order");

-- CreateIndex
CREATE INDEX "about_instruments_sort_order_idx" ON "about_instruments"("sort_order");

-- CreateIndex
CREATE INDEX "about_stack_items_sort_order_idx" ON "about_stack_items"("sort_order");

-- CreateIndex
CREATE INDEX "careers_working_here_sort_order_idx" ON "careers_working_here"("sort_order");

-- CreateIndex
CREATE INDEX "careers_hiring_phases_sort_order_idx" ON "careers_hiring_phases"("sort_order");

-- CreateIndex
CREATE INDEX "careers_commitment_options_sort_order_idx" ON "careers_commitment_options"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "career_roles_slug_key" ON "career_roles"("slug");

-- CreateIndex
CREATE INDEX "career_roles_sort_order_idx" ON "career_roles"("sort_order");

-- CreateIndex
CREATE INDEX "career_role_bullets_role_id_kind_sort_order_idx" ON "career_role_bullets"("role_id", "kind", "sort_order");

-- AddForeignKey
ALTER TABLE "career_role_bullets" ADD CONSTRAINT "career_role_bullets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "career_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS. Supabase exposes every public table through PostgREST to anyone holding the anon key,
-- and that key ships to the browser. Prisma connects as the owner and bypasses RLS, so turning
-- it on with no policies closes the table to everyone else. Every new table needs this.
ALTER TABLE "about_page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "about_premise_paragraphs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "about_principles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "about_build_phases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "about_instruments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "about_stack_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "careers_page" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "careers_working_here" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "careers_hiring_phases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "careers_commitment_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_role_bullets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "about_page", "about_premise_paragraphs", "about_principles",
      "about_build_phases", "about_instruments", "about_stack_items",
      "careers_page", "careers_working_here", "careers_hiring_phases",
      "careers_commitment_options", "career_roles", "career_role_bullets"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "about_page", "about_premise_paragraphs", "about_principles",
      "about_build_phases", "about_instruments", "about_stack_items",
      "careers_page", "careers_working_here", "careers_hiring_phases",
      "careers_commitment_options", "career_roles", "career_role_bullets"
    FROM authenticated;
  END IF;
END
$$;

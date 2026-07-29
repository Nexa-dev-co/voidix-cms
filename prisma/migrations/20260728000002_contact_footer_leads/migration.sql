-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- CreateTable
CREATE TABLE "contact_section" (
    "id" TEXT NOT NULL,
    "eyebrow" VARCHAR(120) NOT NULL,
    "title_line_1" VARCHAR(60) NOT NULL,
    "title_line_2" VARCHAR(60) NOT NULL,
    "description" TEXT NOT NULL,
    "email_address" VARCHAR(320) NOT NULL,
    "form_name_label" VARCHAR(60) NOT NULL,
    "form_email_label" VARCHAR(60) NOT NULL,
    "form_message_label" VARCHAR(60) NOT NULL,
    "submit_label" VARCHAR(40) NOT NULL,
    "success_message" VARCHAR(200) NOT NULL,
    "error_message" VARCHAR(200) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_content" (
    "id" TEXT NOT NULL,
    "tagline" VARCHAR(120) NOT NULL,
    "copyright" VARCHAR(120) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "footer_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_social_links" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "url" VARCHAR(500) NOT NULL,

    CONSTRAINT "footer_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_legal_links" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "url" VARCHAR(500) NOT NULL,

    CONSTRAINT "footer_legal_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "company" VARCHAR(120),
    "message" TEXT NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'contact-form',
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "footer_social_links_sort_order_idx" ON "footer_social_links"("sort_order");

-- CreateIndex
CREATE INDEX "footer_legal_links_sort_order_idx" ON "footer_legal_links"("sort_order");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_ip_hash_created_at_idx" ON "leads"("ip_hash", "created_at");


-- Lock the new tables away from Supabase's auto-generated REST API, exactly as the
-- 20260728000001_enable_rls migration did for the content tables.
--
-- This is appended to the SAME migration as the CREATE TABLEs on purpose. Splitting it into
-- a follow-up migration would leave a window — however short — in which `leads` exists and is
-- readable by anyone holding the anon key. That table holds other people's names, email
-- addresses and messages, so the window has to be zero.

ALTER TABLE "contact_section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "footer_content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "footer_social_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "footer_legal_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "contact_section", "footer_content",
      "footer_social_links", "footer_legal_links",
      "leads"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "contact_section", "footer_content",
      "footer_social_links", "footer_legal_links",
      "leads"
    FROM authenticated;
  END IF;
END
$$;

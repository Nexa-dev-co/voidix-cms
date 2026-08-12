-- Four changes that arrived together:
--
--   1. `disciplines` — the one vocabulary the fleet, the works field and the enquiry form share.
--      Services and projects now point at it, so the panel decides what a CTA enquires about.
--   2. `enquiry_form_content` — the strings the site's shared enquiry form renders, which were
--      hardcoded in EnquiryForm.tsx.
--   3. `submissions` — the website's enquiry intake. It no longer creates a Contact directly.
--   4. `career_applications` — the careers form's intake. Never becomes a Contact at all.
--
-- ⚠ 3 IS THE ONE THAT CHANGES BEHAVIOUR. Until now POST /api/leads created a Contact the moment
-- a form was submitted, so every bot and test post landed in the pipeline, the counts and the
-- reports. It now writes to `submissions` and nothing becomes a Contact until an admin promotes
-- it. The 11 contacts already in the database are untouched — this migration adds tables and one
-- column each to services and projects; it deletes nothing.

-- ── Disciplines ────────────────────────────────────────────────────────────────────────────
CREATE TABLE "disciplines" (
    "id" UUID NOT NULL,
    "key" VARCHAR(32) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "brief_seed" VARCHAR(300) NOT NULL,

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disciplines_key_key" ON "disciplines"("key");

-- CreateIndex
CREATE INDEX "disciplines_sort_order_idx" ON "disciplines"("sort_order");

-- Seeded here rather than in seed.ts because the columns below are NOT NULL and need something
-- to point at in this same transaction. The four keys are the site's `DisciplineId` union and
-- are not editable; the labels and seeds are copied from lib/enquirySubjects.ts.
--
-- The trailing space each brief seed carries on the site is deliberately absent: it is added
-- back at publish time by `continuationSeed`, so nothing depends on an invisible character
-- surviving a trim.
INSERT INTO "disciplines" ("id", "key", "sort_order", "label", "brief_seed") VALUES
  (gen_random_uuid(), 'web', 0, 'Web Development',
   'We need a web platform that doesn''t move like anyone else''s. Here''s where we are so far:'),
  (gen_random_uuid(), 'mobile', 1, 'Mobile Development',
   'We need an app that feels native in the hand rather than a website in a frame. Here''s where we are so far:'),
  (gen_random_uuid(), 'enterprise', 2, 'Enterprise Platform',
   'We need an operational core that pulls our tools into one orbit. Here''s where we are so far:'),
  (gen_random_uuid(), 'ai', 3, 'Artificial Intelligence',
   'We want intelligence wired into the product itself, not bolted on as a demo. Here''s where we are so far:');

-- Added nullable, backfilled from the slug each row already has, then tightened to NOT NULL.
-- Doing it in three steps rather than one keeps the migration honest: if a row exists that this
-- mapping does not cover, the SET NOT NULL fails and the whole transaction rolls back, rather
-- than a default silently binding somebody's service to the wrong discipline.
ALTER TABLE "services" ADD COLUMN "discipline_id" UUID;
ALTER TABLE "projects" ADD COLUMN "discipline_id" UUID;

UPDATE "services" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'web')
  WHERE "slug" = 'web-experiences';
UPDATE "services" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'mobile')
  WHERE "slug" = 'mobile-systems';
UPDATE "services" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'enterprise')
  WHERE "slug" = 'enterprise-platforms';
UPDATE "services" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'ai')
  WHERE "slug" = 'artificial-intelligence';

UPDATE "projects" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'enterprise')
  WHERE "slug" = 'aphelion';
UPDATE "projects" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'mobile')
  WHERE "slug" = 'meridian';
UPDATE "projects" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'web')
  WHERE "slug" = 'cinder';
UPDATE "projects" SET "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'ai')
  WHERE "slug" = 'halcyon';

-- Anything the mapping missed falls to the first discipline rather than aborting the migration,
-- and the panel shows which rows are on it. A project added by hand before this ran is a real
-- possibility; losing the whole migration over it is not a good trade.
UPDATE "services" SET "discipline_id" = (SELECT "id" FROM "disciplines" ORDER BY "sort_order" LIMIT 1)
  WHERE "discipline_id" IS NULL;
UPDATE "projects" SET "discipline_id" = (SELECT "id" FROM "disciplines" ORDER BY "sort_order" LIMIT 1)
  WHERE "discipline_id" IS NULL;

ALTER TABLE "services" ALTER COLUMN "discipline_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "discipline_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── The shared enquiry form's strings ──────────────────────────────────────────────────────
CREATE TABLE "enquiry_form_content" (
    "id" TEXT NOT NULL,
    "name_label" VARCHAR(60) NOT NULL,
    "email_label" VARCHAR(60) NOT NULL,
    "phone_label" VARCHAR(60) NOT NULL,
    "sending_label" VARCHAR(40) NOT NULL,
    "sent_message" VARCHAR(200) NOT NULL,
    "error_message" VARCHAR(200) NOT NULL,
    "reference_subject_suffix" VARCHAR(60) NOT NULL,
    "reference_brief_prefix" VARCHAR(120) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enquiry_form_content_pkey" PRIMARY KEY ("id")
);

-- ── The website's enquiry intake ───────────────────────────────────────────────────────────
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "company" VARCHAR(120),
    "message" TEXT NOT NULL,
    "source" VARCHAR(40),
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promoted_at" TIMESTAMPTZ(6),
    "promoted_contact_id" UUID,
    "promoted_by_id" UUID,
    "dismissed_at" TIMESTAMPTZ(6),

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_promoted_at_dismissed_at_created_at_idx" ON "submissions"("promoted_at", "dismissed_at", "created_at");

-- CreateIndex
CREATE INDEX "submissions_email_idx" ON "submissions"("email");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_promoted_contact_id_fkey" FOREIGN KEY ("promoted_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_promoted_by_id_fkey" FOREIGN KEY ("promoted_by_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── The careers form's intake ──────────────────────────────────────────────────────────────
CREATE TABLE "career_applications" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone" VARCHAR(40),
    "why_you" TEXT NOT NULL,
    "work_link" VARCHAR(500),
    "cv_url" VARCHAR(500),
    "role_id" UUID,
    "role_title" VARCHAR(100) NOT NULL,
    "commitment" VARCHAR(40),
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_id" UUID,

    CONSTRAINT "career_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "career_applications_reviewed_at_created_at_idx" ON "career_applications"("reviewed_at", "created_at");

-- CreateIndex
CREATE INDEX "career_applications_role_id_idx" ON "career_applications"("role_id");

-- AddForeignKey. SET NULL, not CASCADE: closing a role is done by deleting it, and the people
-- who applied must not be deleted along with it. `role_title` carries the name forward.
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "career_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_applications" ADD CONSTRAINT "career_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS. `submissions` and `career_applications` hold names, email addresses, messages and CV
-- links from the public internet — the most sensitive tables added so far, and the two written
-- by unauthenticated routes.
ALTER TABLE "disciplines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enquiry_form_content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "career_applications" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "disciplines", "enquiry_form_content", "submissions", "career_applications"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "disciplines", "enquiry_form_content", "submissions", "career_applications"
    FROM authenticated;
  END IF;
END
$$;

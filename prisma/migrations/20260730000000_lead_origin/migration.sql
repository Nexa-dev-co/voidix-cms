-- Where a lead came from.
--
-- Hand-written rather than generated, for the same reason the pipeline-stage migration was: the
-- auto-generated diff adds `origin_source` as NOT NULL to a table that already has rows in it,
-- which fails outright. This adds it nullable, back-fills every existing contact from its own
-- earliest enquiry, and only then tightens the column.
--
-- No new table, so no new RLS statements — `contacts` is already locked down by
-- 20260729000000_contacts_and_team.

ALTER TABLE "contacts"
  ADD COLUMN "origin_source" "enquiry_source",
  ADD COLUMN "origin_member_id" UUID,
  ADD COLUMN "origin_member_name" VARCHAR(120),
  ADD COLUMN "origin_batch_id" UUID,
  ADD COLUMN "origin_label" VARCHAR(40);

-- A contact's origin is its first touchpoint. DISTINCT ON picks exactly one row per contact;
-- the id tiebreaker keeps the result stable when two enquiries share a timestamp, which is
-- possible for the enquiry written inside the same transaction as the contact.
UPDATE "contacts" AS c
SET
  "origin_source" = earliest.source,
  "origin_batch_id" = earliest.import_batch_id
FROM (
  SELECT DISTINCT ON ("contact_id")
    "contact_id",
    "source",
    "import_batch_id"
  FROM "enquiries"
  ORDER BY "contact_id", "created_at" ASC, "id" ASC
) AS earliest
WHERE earliest."contact_id" = c."id";

-- For imported contacts, the person who added them is whoever uploaded the file.
UPDATE "contacts" AS c
SET
  "origin_member_id" = b."imported_by_id",
  "origin_member_name" = m."name"
FROM "import_batches" AS b
LEFT JOIN "team_members" AS m ON m."id" = b."imported_by_id"
WHERE c."origin_batch_id" = b."id";

-- Manual adds made before this migration recorded no author anywhere, so they stay blank.
-- Guessing from `assigned_to_id` would look like a fact and be wrong for every lead that has
-- been handed to someone else since.
UPDATE "contacts" SET "origin_source" = 'MANUAL' WHERE "origin_source" IS NULL;

ALTER TABLE "contacts" ALTER COLUMN "origin_source" SET NOT NULL;

-- Deliberately no DEFAULT. Every code path that creates a contact has to state where it came
-- from, so a new intake route added later fails to compile rather than quietly recording the
-- wrong channel.

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_origin_member_id_fkey"
    FOREIGN KEY ("origin_member_id") REFERENCES "team_members"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "contacts_origin_batch_id_fkey"
    FOREIGN KEY ("origin_batch_id") REFERENCES "import_batches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "contacts_origin_source_created_at_idx" ON "contacts"("origin_source", "created_at");
CREATE INDEX "contacts_origin_batch_id_idx" ON "contacts"("origin_batch_id");
CREATE INDEX "contacts_origin_member_id_idx" ON "contacts"("origin_member_id");

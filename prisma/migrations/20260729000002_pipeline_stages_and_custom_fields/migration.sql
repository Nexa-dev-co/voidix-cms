-- Pipeline stages replace the NEW/READ/ARCHIVED status, and custom fields let an admin record
-- things this schema never anticipated.
--
-- The statement ORDER here matters and is not what `prisma migrate diff` generates. The generated
-- version adds `stage_id` as NOT NULL against a table that already has rows (which fails outright)
-- and drops `status` before anything has read it (which throws away where each lead had got to).
-- This does it the other way round: create and seed the stages, add the column nullable, back-fill
-- from the status being retired, and only then tighten and drop.

-- CreateEnum
CREATE TYPE "stage_kind" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "custom_field_kind" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'URL', 'SINGLE_SELECT', 'MULTI_SELECT');

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "kind" "stage_kind" NOT NULL DEFAULT 'OPEN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_label_key" ON "pipeline_stages"("label");

-- CreateIndex
CREATE INDEX "pipeline_stages_sort_order_idx" ON "pipeline_stages"("sort_order");

-- Starting pipeline. Admins rename, reorder and retire these in Settings; they are seeded so the
-- feature is usable the moment it exists rather than presenting an empty stage bar. `kind` is what
-- lets the system know Won and Lost end the conversation.
INSERT INTO "pipeline_stages" ("id", "sort_order", "label", "kind", "is_active") VALUES
  (gen_random_uuid(), 0, 'New', 'OPEN', true),
  (gen_random_uuid(), 1, 'Contacted', 'OPEN', true),
  (gen_random_uuid(), 2, 'Qualified', 'OPEN', true),
  (gen_random_uuid(), 3, 'Proposal', 'OPEN', true),
  (gen_random_uuid(), 4, 'Won', 'WON', true),
  (gen_random_uuid(), 5, 'Lost', 'LOST', true);

-- CreateTable
CREATE TABLE "contact_stage_changes" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "member_id" UUID,
    "member_name" VARCHAR(120) NOT NULL,
    "from_stage" VARCHAR(60),
    "to_stage" VARCHAR(60) NOT NULL,
    "reason" TEXT,
    "attempt_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_field_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "kind" "custom_field_kind" NOT NULL,
    "options" TEXT[],
    "help_text" VARCHAR(200),
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_field_values" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(18,4),
    "value_date" DATE,
    "value_boolean" BOOLEAN,
    "value_options" TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_stage_changes_attempt_id_key" ON "contact_stage_changes"("attempt_id");

-- CreateIndex
CREATE INDEX "contact_stage_changes_contact_id_created_at_idx" ON "contact_stage_changes"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "contact_stage_changes_member_id_created_at_idx" ON "contact_stage_changes"("member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contact_field_definitions_key_key" ON "contact_field_definitions"("key");

-- CreateIndex
CREATE INDEX "contact_field_definitions_sort_order_idx" ON "contact_field_definitions"("sort_order");

-- CreateIndex
CREATE INDEX "contact_field_values_definition_id_value_text_idx" ON "contact_field_values"("definition_id", "value_text");

-- CreateIndex
CREATE INDEX "contact_field_values_definition_id_value_number_idx" ON "contact_field_values"("definition_id", "value_number");

-- CreateIndex
CREATE INDEX "contact_field_values_definition_id_value_date_idx" ON "contact_field_values"("definition_id", "value_date");

-- CreateIndex
CREATE UNIQUE INDEX "contact_field_values_contact_id_definition_id_key" ON "contact_field_values"("contact_id", "definition_id");

-- AlterTable
ALTER TABLE "contact_attempts" ADD COLUMN "next_due_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "lead_settings" ADD COLUMN "leads_table_columns" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "sales_can_close_leads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sales_can_edit_custom_fields" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable — stage_id goes on NULLABLE so the back-fill below has something to write into.
ALTER TABLE "contacts" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "next_follow_up_at" TIMESTAMPTZ(6),
ADD COLUMN "stage_id" UUID;

-- Back-fill from the status being retired. NEW is where a lead starts; READ meant somebody had
-- worked it, which is what Contacted means now. ARCHIVED was a way of hiding a lead rather than a
-- position in a pipeline, so it becomes the flag and the stage falls back to New — the honest
-- answer, since the old value did not record where they had actually got to.
UPDATE "contacts" SET "stage_id" = (SELECT "id" FROM "pipeline_stages" WHERE "label" = 'New')
  WHERE "status" IN ('NEW', 'ARCHIVED');
UPDATE "contacts" SET "stage_id" = (SELECT "id" FROM "pipeline_stages" WHERE "label" = 'Contacted')
  WHERE "status" = 'READ';
UPDATE "contacts" SET "is_archived" = true WHERE "status" = 'ARCHIVED';

-- Belt and braces: anything the mapping above missed still gets a stage, because the column is
-- about to become NOT NULL and a failure here would leave the migration half-applied.
UPDATE "contacts" SET "stage_id" = (SELECT "id" FROM "pipeline_stages" WHERE "label" = 'New')
  WHERE "stage_id" IS NULL;

-- Only now is it safe to require it.
ALTER TABLE "contacts" ALTER COLUMN "stage_id" SET NOT NULL;

-- DropIndex
DROP INDEX "contacts_assigned_to_id_status_idx";

-- DropIndex
DROP INDEX "contacts_status_created_at_idx";

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "status";

-- DropEnum
DROP TYPE "lead_status";

-- CreateIndex
CREATE INDEX "contacts_stage_id_created_at_idx" ON "contacts"("stage_id", "created_at");

-- CreateIndex
CREATE INDEX "contacts_assigned_to_id_stage_id_idx" ON "contacts"("assigned_to_id", "stage_id");

-- CreateIndex
CREATE INDEX "contacts_is_archived_next_follow_up_at_idx" ON "contacts"("is_archived", "next_follow_up_at");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_stage_changes" ADD CONSTRAINT "contact_stage_changes_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_stage_changes" ADD CONSTRAINT "contact_stage_changes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_stage_changes" ADD CONSTRAINT "contact_stage_changes_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "contact_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_field_values" ADD CONSTRAINT "contact_field_values_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_field_values" ADD CONSTRAINT "contact_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "contact_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same lockdown as every other table, in the same migration as the CREATE TABLEs — not a
-- follow-up one, which would leave a window in which these are world-readable through PostgREST.
--
-- `contact_field_values` is the sharp one here: a team that adds a "Budget" or "Notes from the
-- call" field is putting commercially sensitive material in a table the anon key would otherwise
-- reach. `pipeline_stages` matters for a different reason — it is writable vocabulary, and a
-- rewritten stage label is a rewritten pipeline.

ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_stage_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_field_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_field_values" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "pipeline_stages", "contact_stage_changes", "contact_field_definitions", "contact_field_values" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "pipeline_stages", "contact_stage_changes", "contact_field_definitions", "contact_field_values" FROM authenticated;
  END IF;
END
$$;

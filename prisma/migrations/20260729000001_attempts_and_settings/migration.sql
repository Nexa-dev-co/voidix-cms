-- CreateEnum
CREATE TYPE "auto_assign_mode" AS ENUM ('UNASSIGNED', 'ROUND_ROBIN', 'FIXED');

-- CreateTable
CREATE TABLE "contact_attempts" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "member_id" UUID,
    "member_name" VARCHAR(120) NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "outcome" VARCHAR(60) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_channels" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attempt_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_outcomes" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attempt_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_settings" (
    "id" TEXT NOT NULL,
    "auto_assign_mode" "auto_assign_mode" NOT NULL DEFAULT 'UNASSIGNED',
    "auto_assign_member_id" UUID,
    "last_assigned_member_id" UUID,
    "sales_can_edit_contact" BOOLEAN NOT NULL DEFAULT true,
    "sales_can_claim_unassigned" BOOLEAN NOT NULL DEFAULT false,
    "sales_can_export" BOOLEAN NOT NULL DEFAULT false,
    "sales_can_see_others_attempts" BOOLEAN NOT NULL DEFAULT false,
    "import_default_match_action" VARCHAR(16) NOT NULL DEFAULT 'enrich',
    "import_max_rows" INTEGER NOT NULL DEFAULT 5000,
    "import_allow_overwrite" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_attempts_contact_id_created_at_idx" ON "contact_attempts"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "contact_attempts_member_id_created_at_idx" ON "contact_attempts"("member_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_channels_label_key" ON "attempt_channels"("label");

-- CreateIndex
CREATE INDEX "attempt_channels_sort_order_idx" ON "attempt_channels"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_outcomes_label_key" ON "attempt_outcomes"("label");

-- CreateIndex
CREATE INDEX "attempt_outcomes_sort_order_idx" ON "attempt_outcomes"("sort_order");

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempts" ADD CONSTRAINT "contact_attempts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Same lockdown as every other table, in the same migration as the CREATE TABLEs.
-- `contact_attempts` records who called whom and what was said; `lead_settings` decides what
-- the Sales role is permitted to do, so a writable copy through PostgREST would let anyone
-- with the anon key grant themselves permissions.

ALTER TABLE "contact_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attempt_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attempt_outcomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_settings" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "contact_attempts", "attempt_channels", "attempt_outcomes", "lead_settings" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "contact_attempts", "attempt_channels", "attempt_outcomes", "lead_settings" FROM authenticated;
  END IF;
END
$$;

-- Starting vocabulary. Admins edit these in Settings; they are seeded so the attempt form is
-- usable the moment the feature exists rather than presenting two empty dropdowns.
INSERT INTO "attempt_channels" ("id", "sort_order", "label", "is_active") VALUES
  (gen_random_uuid(), 0, 'Call', true),
  (gen_random_uuid(), 1, 'Email', true),
  (gen_random_uuid(), 2, 'WhatsApp', true),
  (gen_random_uuid(), 3, 'Meeting', true),
  (gen_random_uuid(), 4, 'Other', true);

INSERT INTO "attempt_outcomes" ("id", "sort_order", "label", "is_active") VALUES
  (gen_random_uuid(), 0, 'No answer', true),
  (gen_random_uuid(), 1, 'Spoke — interested', true),
  (gen_random_uuid(), 2, 'Spoke — not now', true),
  (gen_random_uuid(), 3, 'Callback booked', true),
  (gen_random_uuid(), 4, 'Not interested', true),
  (gen_random_uuid(), 5, 'Wrong number', true);

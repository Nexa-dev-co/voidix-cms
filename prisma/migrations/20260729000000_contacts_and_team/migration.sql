-- CreateEnum
CREATE TYPE "team_role" AS ENUM ('ADMIN', 'SALES');

-- CreateEnum
CREATE TYPE "enquiry_source" AS ENUM ('CONTACT_FORM', 'MANUAL', 'IMPORT');

-- DropTable
DROP TABLE "leads";

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "team_role" NOT NULL DEFAULT 'SALES',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "company" VARCHAR(120),
    "phone" VARCHAR(40),
    "status" "lead_status" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "assigned_to_id" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "source" "enquiry_source" NOT NULL,
    "message" TEXT,
    "import_batch_id" UUID,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "imported_by_id" UUID,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "enriched_count" INTEGER NOT NULL DEFAULT 0,
    "logged_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_auth_user_id_key" ON "team_members"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_status_created_at_idx" ON "contacts"("status", "created_at");

-- CreateIndex
CREATE INDEX "contacts_assigned_to_id_status_idx" ON "contacts"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "enquiries_contact_id_created_at_idx" ON "enquiries"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "enquiries_ip_hash_created_at_idx" ON "enquiries"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_created_at_idx" ON "import_batches"("created_at");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Same lockdown as every other table here, in the same migration as the CREATE TABLEs so
-- there is no window where `contacts` or `enquiries` exist and are readable through
-- Supabase's REST API. These hold other people's names, emails, phone numbers and messages.
--
-- `team_members` matters for a second reason: it carries the role column. If it were readable
-- and writable through PostgREST, anyone with the anon key could grant themselves ADMIN.

ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_batches" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "team_members", "contacts", "enquiries", "import_batches" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "team_members", "contacts", "enquiries", "import_batches" FROM authenticated;
  END IF;
END
$$;

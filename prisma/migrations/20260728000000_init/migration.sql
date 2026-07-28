-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "eyebrow" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_capabilities" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,

    CONSTRAINT "service_capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "client" VARCHAR(120) NOT NULL,
    "year" VARCHAR(8) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tags" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(40) NOT NULL,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_entries" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "question" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_paragraphs" (
    "id" UUID NOT NULL,
    "faq_entry_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "faq_paragraphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_releases" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "note" VARCHAR(200),
    "published_by" VARCHAR(320),
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revalidate_status" VARCHAR(16),
    "revalidate_detail" TEXT,

    CONSTRAINT "content_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_sort_order_idx" ON "services"("sort_order");

-- CreateIndex
CREATE INDEX "service_capabilities_service_id_sort_order_idx" ON "service_capabilities"("service_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_sort_order_idx" ON "projects"("sort_order");

-- CreateIndex
CREATE INDEX "project_tags_project_id_sort_order_idx" ON "project_tags"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "faq_entries_sort_order_idx" ON "faq_entries"("sort_order");

-- CreateIndex
CREATE INDEX "faq_paragraphs_faq_entry_id_sort_order_idx" ON "faq_paragraphs"("faq_entry_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "content_releases_version_key" ON "content_releases"("version");

-- CreateIndex
CREATE INDEX "content_releases_published_at_idx" ON "content_releases"("published_at");

-- AddForeignKey
ALTER TABLE "service_capabilities" ADD CONSTRAINT "service_capabilities_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_paragraphs" ADD CONSTRAINT "faq_paragraphs_faq_entry_id_fkey" FOREIGN KEY ("faq_entry_id") REFERENCES "faq_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reshapes Contact and Footer to match the sections the site actually built.
--
-- Both tables were designed before their sections existed and guessed wrong. Contact assumed a
-- two-line title, an eyebrow, a standalone email address and six form strings; the site renders
-- ONE title string, hardcodes the eyebrow in JSX, keeps the address as a link in the footer's
-- `Direct` group, and hardcodes every form label but two. Footer assumed a flat social list and
-- a flat legal list; the site has one array of TITLED GROUPS feeding both the homepage's contact
-- footer and PageFooter on the document routes.
--
-- Destructive, and safe precisely because it is early: contact_section and footer_content hold
-- no rows, the two link tables are empty, and content_releases is empty, so nothing published
-- depends on the old shape. Doing this after the first release would have meant carrying both
-- shapes in the payload forever.

-- ── Contact ────────────────────────────────────────────────────────────────────────────────
-- Rebuilt rather than altered column by column: the table is empty, and a rename plus five
-- drops plus two adds is far harder to read than the shape it ends up at.
DROP TABLE "contact_section";

CREATE TABLE "contact_section" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "lead" TEXT NOT NULL,
    "brief_label" VARCHAR(60) NOT NULL,
    "submit_label" VARCHAR(40) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_section_pkey" PRIMARY KEY ("id")
);

-- ── Footer ─────────────────────────────────────────────────────────────────────────────────
-- `copyright` becomes `sign_off`: the site's bottom line is a statement of what the studio is
-- ("Voidix — a software studio. Built with its own gravity."), not a © notice with a year in it,
-- so the old name described something the site does not have.
ALTER TABLE "footer_content" DROP COLUMN "copyright";
ALTER TABLE "footer_content" ADD COLUMN "sign_off" VARCHAR(160) NOT NULL;

DROP TABLE "footer_social_links";
DROP TABLE "footer_legal_links";

CREATE TABLE "footer_link_groups" (
    "id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title" VARCHAR(40) NOT NULL,

    CONSTRAINT "footer_link_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "footer_links" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "href" VARCHAR(500) NOT NULL,

    CONSTRAINT "footer_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "footer_link_groups_sort_order_idx" ON "footer_link_groups"("sort_order");

-- CreateIndex
CREATE INDEX "footer_links_group_id_sort_order_idx" ON "footer_links"("group_id", "sort_order");

-- AddForeignKey
ALTER TABLE "footer_links" ADD CONSTRAINT "footer_links_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "footer_link_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS. `contact_section` was dropped and recreated, so it lost the row security the original
-- migration gave it — re-enabling it here is not belt-and-braces, it is required.
ALTER TABLE "contact_section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "footer_link_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "footer_links" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "contact_section", "footer_link_groups", "footer_links" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "contact_section", "footer_link_groups", "footer_links" FROM authenticated;
  END IF;
END
$$;

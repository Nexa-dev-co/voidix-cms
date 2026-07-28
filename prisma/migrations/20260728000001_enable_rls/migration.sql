-- Lock the content tables away from Supabase's auto-generated REST API.
--
-- Supabase exposes every table in the `public` schema through PostgREST, reachable by anyone
-- holding the anon key — and the anon key ships to the browser by design. Without this
-- migration the whole CMS would be publicly readable and writable at
-- https://<project>.supabase.co/rest/v1/services, no login required.
--
-- Enabling RLS with NO policies is a deny-all for the `anon` and `authenticated` roles.
-- It does not affect this app: Prisma connects as the database owner over the Postgres
-- connection string, and owners bypass RLS unless FORCE ROW LEVEL SECURITY is set (it is
-- deliberately not set here — forcing it would lock out the CMS itself).
--
-- The consequence to know about: because access is deny-all rather than policy-based, these
-- tables can only ever be read through this application or the SQL editor. If the voidix site
-- is later wired to read published content directly via the Supabase JS client rather than
-- through a server-side connection, it will need an explicit SELECT policy on
-- content_releases — a policy, not a blanket disable of RLS.

ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faq_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faq_paragraphs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_releases" ENABLE ROW LEVEL SECURITY;

-- Supabase's default privileges grant the API roles table access as soon as a table is
-- created. RLS already blocks every row, but revoking the grants as well means an accidental
-- future "disable RLS just to debug something" doesn't silently open the door.
-- Guarded so this migration still applies on a plain Postgres instance without those roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE
      "services", "service_capabilities",
      "projects", "project_tags",
      "faq_entries", "faq_paragraphs",
      "content_releases"
    FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE
      "services", "service_capabilities",
      "projects", "project_tags",
      "faq_entries", "faq_paragraphs",
      "content_releases"
    FROM authenticated;
  END IF;
END
$$;

-- Give a project its own MARK — the logo the site's works field cuts into interlocking stones.
--
-- Until now the four marks were files in the site's `public/logos/`, chosen by a `markId` that only
-- existed in the site's source. That is why this table could add a project the site could not show:
-- there was no fifth logo, and no way for an editor to supply one. Now there is.
--
-- ── Two columns, and the second one is not redundant ─────────────────────────────────────────────
--  * `mark_svg_url`      the public URL, and the only half that gets published.
--  * `mark_storage_path` the object's path inside the bucket. A public URL is not a handle you can
--                        delete by, so without this, replacing a mark twice leaves two orphaned
--                        files in the bucket that nothing knows the name of.
--
-- Both are nullable and null is a real state, not a missing value: a project with no mark grows its
-- own INITIAL on the site, which is a designed fallback rather than a blank.
--
-- ── ⚠ Why the bucket is PUBLIC, when the point of this design was not to expose anything ─────────
-- The site never hands this URL to a browser. Its server dereferences the URL while rendering and
-- passes the page the SVG source, so the storage host appears nowhere in the HTML. A private bucket
-- would force the alternative — signed URLs, or the service-role key living in the website — and
-- putting a key that bypasses RLS on every table into the public marketing site is a far worse
-- trade than a bucket of brand logos being readable by whoever already knows an object's URL.
--
-- Writes do NOT go through this bucket's policies. Uploads run in a server action behind
-- `requireAdmin()` using the service-role key, which bypasses RLS entirely — so there is one writer,
-- it is authenticated by code we already trust, and there is no storage policy to get subtly wrong.

ALTER TABLE "projects" ADD COLUMN "mark_svg_url" VARCHAR(500);
ALTER TABLE "projects" ADD COLUMN "mark_storage_path" VARCHAR(200);

-- The bucket itself.
--
-- ⚠ Wrapped so it cannot fail the migration. Ownership of the `storage` schema differs between a
-- hosted Supabase project, a local `supabase start`, and a plain Postgres someone pointed this at —
-- and a migration that dies here would block every unrelated change behind it for the sake of one
-- row. If it is skipped, create a public bucket named `marks` in the dashboard; nothing else in
-- this migration depends on it.
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('marks', 'marks', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not create the "marks" storage bucket (%). Create it by hand: a PUBLIC bucket named "marks".', SQLERRM;
END $$;

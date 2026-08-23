-- ═══════════════════════════════════════════════════════════════════════════════════════════════
--  Journey analytics · the nightly rollup and retention sweep
--
--  Run this ONCE, by hand, in the Supabase SQL editor against the production database. Then confirm
--  it took with the queries at the bottom.
--
--  ── ⚠ WHY THIS IS NOT A PRISMA MIGRATION ─────────────────────────────────────────────────────
--  Two reasons, and both are about what a migration would do somewhere it was not wanted.
--
--  1 · It carries a SECRET. A migration is committed, and `JOURNEY_MAINTENANCE_SECRET` is the key to
--      an endpoint whose entire job is DELETING DATA. It does not belong in the repository.
--  2 · A migration runs on every database it is applied to. `prisma migrate deploy` on a developer's
--      machine, or against a staging copy, would schedule a job there too — pointing at whichever URL
--      was baked in, which is production. A dev database quietly deleting production's analytics
--      every night is a strictly worse outcome than a documented manual step.
--
--  ── ⚠ THE SITE'S PRIVACY NOTICE STATES NINETY DAYS ───────────────────────────────────────────
--  Until this is scheduled, that is a plan rather than a behaviour, and a page claiming a deletion
--  nothing performs is worse than one claiming none. This script is a prerequisite for production.
--
--  ── ⚠ ROLL UP FIRST, DELETE SECOND — AND THE ROUTE ALREADY DOES ──────────────────────────────
--  `runJourneyMaintenance` owns that ordering. Nothing here should ever be "helpfully" reduced to a
--  DELETE: the rollup is an `INSERT … SELECT … GROUP BY`, so a day whose raw rows are already gone
--  produces no row at all and `ON CONFLICT` never fires. The loss would be silent and unrecoverable.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1 · The two extensions ─────────────────────────────────────────────────────────────────────
-- `pg_cron` runs the schedule; `pg_net` is what lets a database row make an HTTP request. Both ship
-- with Supabase but are off until asked for. ⚠ On Supabase `pg_cron` installs into the `cron` schema
-- and `pg_net` into `extensions` — do not relocate either, the helper names below assume it.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── 2 · The schedule ───────────────────────────────────────────────────────────────────────────
-- ⚠ REPLACE BOTH PLACEHOLDERS BEFORE RUNNING.
--   <PANEL_URL>  the panel's deployed origin, no trailing slash — e.g. https://panel.example.com
--   <SECRET>     the value of JOURNEY_MAINTENANCE_SECRET in the panel's environment
--
-- ⚠ 03:00 UTC, not local. pg_cron schedules in the database's timezone, which on Supabase is UTC —
-- so this is a quiet hour for a European studio and it does not drift with daylight saving. The hour
-- matters only in that the sweep should not land in the middle of a working session.
--
-- ⚠ The header is `x-journey-maintenance`, which is the route's OWN secret and deliberately not the
-- intake one. `LEADS_INTAKE_SECRET` is held by the public website; this endpoint deletes data, and
-- the website has no reason to hold a key that can empty the analytics tables.
select cron.schedule(
  'journey-maintenance',
  '0 3 * * *',
  $$
    select net.http_post(
      url := '<PANEL_URL>/api/journey/maintenance',
      headers := '{"content-type":"application/json","x-journey-maintenance":"<SECRET>"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

-- ── 3 · Confirm it exists ──────────────────────────────────────────────────────────────────────
-- Expect exactly one row, active, with the schedule above.
--   select jobid, schedule, jobname, active from cron.job where jobname = 'journey-maintenance';

-- ── 4 · Confirm it RAN — and this is the check worth actually doing ────────────────────────────
-- ⚠ `pg_cron` reports whether the STATEMENT succeeded, and `net.http_post` succeeds by queueing a
-- request. A 401 from a wrong secret, or a 500 from the route, is therefore a SUCCEEDED cron job
-- whose retention did nothing. The second query is the one that can tell you that.
--
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobname = 'journey-maintenance'
--    order by start_time desc limit 5;
--
--   select status_code, content::text, created
--     from net._http_response
--    order by created desc limit 5;
--
-- ⚠ Then check the work itself, which is the only proof that matters:
--   select count(*) from journey_daily;
--   select min(received_at) from journey_events;   -- must never be older than 90 days

-- ── Undo ───────────────────────────────────────────────────────────────────────────────────────
--   select cron.unschedule('journey-maintenance');

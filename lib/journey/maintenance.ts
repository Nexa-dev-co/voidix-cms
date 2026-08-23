import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The nightly job: fold the raw stream into daily counts, then delete what has been counted.
 *
 * ── ⚠ ROLL UP FIRST, DELETE SECOND, AND NEVER THE OTHER WAY ────────────────────────────────────
 * Obvious written down, easy to reverse when someone later "tidies" the order. Deleting first
 * discards the rows the rollup was about to read, and the loss is silent — the job reports success
 * and the day simply has no history.
 *
 * ── ⚠ WHY RE-RUNNING THIS CANNOT ZERO AN EARLIER DAY ───────────────────────────────────────────
 * The natural fear with an upsert over a table that is being emptied: roll up Monday, delete
 * Monday's raw rows, run again, and Monday recomputes as zero and overwrites itself.
 *
 * It cannot happen, and the reason is structural rather than a guard. The rollup is `INSERT … SELECT
 * … GROUP BY`, so a day with no remaining raw rows produces NO ROW AT ALL — there is nothing for
 * `ON CONFLICT` to update, and the stored figures stand untouched. If this is ever rewritten as a
 * read-then-write in application code, that property is lost and the guard becomes real work.
 *
 * ── ⚠ ONLY COMPLETE DAYS ───────────────────────────────────────────────────────────────────────
 * `received_at < date_trunc('day', now())` — today is still accumulating, and a partial day written
 * into a table meant for finished ones would be indistinguishable from a quiet one.
 */

/** Everything is kept the same length of time — one rule, one sweep, one sentence on the privacy page. */
export const RETENTION_DAYS = 90;

export interface MaintenanceResult {
  rolledUpRows: number;
  deletedEvents: number;
  deletedGrids: number;
  deletedPaths: number;
}

/**
 * ⚠ `COALESCE(section, '')` — the rollup's `section` is NOT NULL because it is part of the unique
 * key, and Postgres treats NULLs in a unique index as distinct from one another. The raw table keeps
 * NULL because there the column is genuinely absent data. The migration's comment has the long
 * version; this is where the two representations actually meet.
 *
 * ⚠ The median guards its own cast. `detail->>'dwellMs'` is text out of JSONB and exists on exactly
 * one event type, so the regex is what stops a malformed or unexpected value aborting the entire
 * statement — `percentile_cont` then ignores the NULLs the CASE produces for every other row.
 */
const ROLLUP_SQL = `
  INSERT INTO journey_daily (
    id, day, name, section, event_count, session_count, visitor_count, median_dwell_ms, built_at
  )
  SELECT
    gen_random_uuid(),
    date_trunc('day', received_at)::date,
    name,
    COALESCE(section, ''),
    COUNT(*)::int,
    COUNT(DISTINCT session_id)::int,
    NULLIF(COUNT(DISTINCT visitor_id), 0)::int,
    (percentile_cont(0.5) WITHIN GROUP (
      ORDER BY CASE
        WHEN name = 'stop:dwell' AND detail->>'dwellMs' ~ '^[0-9]+$'
        THEN (detail->>'dwellMs')::numeric
      END
    ))::int,
    now()
  FROM journey_events
  WHERE received_at < date_trunc('day', now())
  GROUP BY date_trunc('day', received_at)::date, name, COALESCE(section, '')
  ON CONFLICT (day, name, section) DO UPDATE SET
    event_count     = EXCLUDED.event_count,
    session_count   = EXCLUDED.session_count,
    visitor_count   = EXCLUDED.visitor_count,
    median_dwell_ms = EXCLUDED.median_dwell_ms,
    built_at        = now()
`;

export async function runJourneyMaintenance(): Promise<MaintenanceResult> {
  const rolledUpRows = await prisma.$executeRawUnsafe(ROLLUP_SQL);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // ⚠ Three separate deletes rather than one cascade: the tables have no foreign keys between them,
  // deliberately — a cursor grid is not a child of an event, it is a summary of the same span of
  // time. Wiring a cascade would create a delete order that has to be right forever.
  const [deletedEvents, deletedGrids, deletedPaths] = await Promise.all([
    prisma.journeyEvent.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
    prisma.journeyCursorGrid.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
    prisma.journeyCursorPath.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
  ]);

  return {
    rolledUpRows,
    deletedEvents: deletedEvents.count,
    deletedGrids: deletedGrids.count,
    deletedPaths: deletedPaths.count,
  };
}

/**
 * Erase everything that can point at one consented visitor.
 *
 * ── ⚠ PATHS ARE DELETED; EVENTS ARE DOWNGRADED. THE ASYMMETRY IS THE POINT ─────────────────────
 * A cursor path is behavioural biometry and could only ever have been collected with consent, so
 * withdrawing consent destroys it outright — `visitor_id` is NOT NULL on that table precisely so a
 * path nobody agreed to is unrepresentable.
 *
 * The events are different. Strip the `visitor_id` and what remains is exactly a tier 1 event: an
 * anonymous count that needed no permission in the first place and that the site would have recorded
 * for this visitor either way. Deleting those would not restore any privacy — the link is what was
 * sensitive, and the link is what goes. `tier` is moved to 1 in the same statement so the row cannot
 * later be read as a consented one with a missing id.
 *
 * ⚠ Both halves must happen or neither. A transaction, because a half-erasure that left paths behind
 * is the failure that matters and it would look like success.
 */
export async function forgetVisitor(visitorId: string): Promise<{ paths: number; events: number }> {
  const [paths, events] = await prisma.$transaction([
    prisma.journeyCursorPath.deleteMany({ where: { visitorId } }),
    prisma.journeyEvent.updateMany({
      where: { visitorId },
      data: { visitorId: null, tier: 1 },
    }),
  ]);

  return { paths: paths.count, events: events.count };
}

import { NextResponse } from "next/server";

import { runJourneyMaintenance } from "@/lib/journey/maintenance";
import { isEqualInConstantTime } from "@/lib/sharedSecret";

/**
 * The nightly rollup and deletion, as a route.
 *
 * ── ⚠ A ROUTE RATHER THAN A CRON DEFINITION, SO THE TRIGGER STAYS A SEPARATE DECISION ──────────
 * The work is identical whichever way it is fired, and the trigger that shipped is **Supabase
 * pg_cron** — `prisma/scripts/journey-maintenance-cron.sql`, run once by hand against production.
 * It was chosen over a Vercel Cron entry because it needs no deployment platform and lives with the
 * database it sweeps. That file also explains why it is a SCRIPT and not a migration: it carries a
 * secret, and a migration would schedule the job on every database it was ever applied to.
 *
 * ⚠ Until that script has actually been run against a given database, **the retention period is a
 * plan rather than a behaviour** — and the site's privacy notice states ninety days. Check with
 * `select * from cron.job where jobname = 'journey-maintenance';` before believing it.
 *
 * ⚠ AND CHECKING `cron.job_run_details` IS NOT ENOUGH. `net.http_post` succeeds by QUEUEING a
 * request, so a wrong secret gives a 401 to a cron job that reports success. `net._http_response`
 * holds the status code that actually came back. The script has both queries written out.
 *
 * ── ⚠ ITS OWN SECRET, NOT THE INTAKE ONE ───────────────────────────────────────────────────────
 * `LEADS_INTAKE_SECRET` is held by the website, which is a public-facing system that posts to this
 * panel all day. This endpoint DELETES DATA. Giving the two the same key would mean the site's
 * secret, if it ever leaked, could also be used to empty the analytics tables — a capability the
 * website has no reason to hold.
 *
 * ⚠ Fails closed. An unset secret refuses rather than running unauthenticated, which for a
 * destructive endpoint is the only safe direction.
 *
 * ⚠ It is NOT in `PUBLIC_PATHS`. A cron caller reaches it with the header below; a browser reaches
 * the login page. That is the correct asymmetry for something that deletes.
 */
export const dynamic = "force-dynamic";

/** Long enough for a rollup over a busy month; short enough that a stuck job is visible. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const configuredSecret = process.env.JOURNEY_MAINTENANCE_SECRET;

  if (!configuredSecret) {
    console.warn("[journey] JOURNEY_MAINTENANCE_SECRET is unset — refusing to run maintenance");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const provided =
    request.headers.get("x-journey-maintenance") ??
    // Vercel Cron sends its own bearer; accepted so the same route serves either trigger.
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided || !isEqualInConstantTime(provided, configuredSecret)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const result = await runJourneyMaintenance();

    // Logged as well as returned: a cron trigger throws the response away, and this is the only
    // record that the sweep ran and what it touched.
    console.info(
      `[journey] maintenance: rolled up ${result.rolledUpRows} day-rows, deleted ` +
        `${result.deletedEvents} events, ${result.deletedGrids} grids, ${result.deletedPaths} paths`,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[journey] maintenance FAILED: ${message}`);
    // ⚠ A real 500. Unlike the intake, this one has a caller that can retry and a human who needs to
    // know — a silent 204 here would let retention quietly stop happening for weeks.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

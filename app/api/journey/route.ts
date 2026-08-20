import { NextResponse } from "next/server";

import {
  journeyBatchSchema,
  SUPPORTED_SCHEMA_VERSION,
  type CursorPathInput,
  type JourneyEventInput,
} from "@/lib/journey/intakeSchema";
import { isEqualInConstantTime } from "@/lib/sharedSecret";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The site's journey batches.
 *
 * One of the routes reachable without logging in — see `PUBLIC_PATHS` in `lib/supabase/proxy.ts`,
 * which carries the obligation this file has to meet.
 *
 * ── ⚠ IT DOES NOT USE `checkIntakeAllowed`, AND THAT IS A DECISION ─────────────────────────────
 * The forms' guard is right for forms and wrong here in one respect that matters: its rate limit is
 * sized for a human submitting a message, and a journey batch arrives every ten seconds of every
 * visit. Reusing it would rate-limit ordinary traffic into nothing and the symptom would be a
 * dashboard that quietly under-counts busy days. The secret check is shared — `isEqualInConstantTime`
 * is the same comparison — and the origin check is not needed because there is nothing here worth
 * forging: an attacker's reward for guessing the secret is the ability to insert fake analytics.
 *
 * ── ⚠ BOTS ARE FILTERED HERE, NOT IN THE DASHBOARD ─────────────────────────────────────────────
 * Uptime monitors, preview crawlers and link-preview fetchers all execute JavaScript now. Unfiltered
 * they inflate `intro:start` without ever reaching `intro:complete` — landing squarely on the one
 * metric this feature exists for and making the loader look far worse than it is. Filtering at read
 * time would mean every future query had to remember to do it.
 *
 * ── ⚠ A `tier: 1` EVENT CARRYING A `visitorId` IS REJECTED, NOT REPAIRED ───────────────────────
 * It cannot happen from the site's own collector — the id is only ever spread in when it exists — so
 * a batch containing one is either a bug worth seeing or a forgery. Silently dropping the field would
 * store the row and hide both.
 */
export const dynamic = "force-dynamic";

/** Cheap, deliberately incomplete, and only ever used to DISCARD. Never to identify. */
const BOT_USER_AGENT = /bot|crawler|spider|crawling|headless|lighthouse|pingdom|uptime|monitor|preview/i;

export async function POST(request: Request) {
  const configuredSecret = process.env.LEADS_INTAKE_SECRET;

  if (!configuredSecret) {
    console.warn("[journey] LEADS_INTAKE_SECRET is unset — refusing the batch");
    return new NextResponse(null, { status: 204 });
  }

  const providedSecret = request.headers.get("x-voidix-secret");

  if (!providedSecret || !isEqualInConstantTime(providedSecret, configuredSecret)) {
    // 204 like every other outcome. A caller probing this should not be able to tell a bad secret
    // from a filtered bot from a stored batch — that difference is a map of the defences.
    return new NextResponse(null, { status: 204 });
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_USER_AGENT.test(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = journeyBatchSchema.safeParse(body);

  if (!parsed.success) {
    console.warn(`[journey] rejected a malformed batch: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    return new NextResponse(null, { status: 204 });
  }

  if (parsed.data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    console.warn(
      `[journey] schema mismatch: site sent v${parsed.data.schemaVersion}, this panel knows v${SUPPORTED_SCHEMA_VERSION}. ` +
        "The two repos have drifted — see lib/journey/intakeSchema.ts.",
    );
    return new NextResponse(null, { status: 204 });
  }

  /**
   * ⚠ `sessionId` AND `visitorId` COME FROM THE ENVELOPE, never from `events[0]`.
   *
   * They used to be read off the first event, which held only while a flush was a single body. The
   * site splits a flush on BYTES and packs events first, so every body after the first carries
   * cursor payloads and no event at all — and a client-side navigation flushes a lone grid with no
   * event beside it. Both arrived unattributable and every grid and path in them was dropped here.
   */
  const { events, cursorGrids, cursorPaths, sessionId, visitorId: consentedVisitorId } = parsed.data;

  if (events.some(isTierMismatch)) {
    console.warn("[journey] rejected a batch: a tier 1 event carried a visitorId");
    return new NextResponse(null, { status: 204 });
  }

  /**
   * ⚠ An event may not claim a session the envelope does not. The envelope is what every cursor
   * payload is filed under, so a batch mixing two session ids would silently file one visit's
   * heatmap against another's — and unlike the tier check there is no column that would catch it
   * later. It cannot happen from the site's own collector, which reads both from one place.
   */
  if (events.some((event) => event.sessionId !== sessionId)) {
    console.warn("[journey] rejected a batch: an event disagreed with the envelope's sessionId");
    return new NextResponse(null, { status: 204 });
  }

  /**
   * ⚠ A path without a visitor id cannot be stored — `visitor_id` is NOT NULL on that table
   * precisely so a path nobody consented to is unrepresentable. The site should never send one;
   * if it does, the grids and events in the same batch are still perfectly good, so they are kept
   * and only the paths are dropped.
   */
  const storableGrids = cursorGrids ?? [];
  /**
   * ⚠ The visitor id is bound to each row HERE, inside the branch that proves it exists, rather
   * than asserted with a cast at the insert. `visitor_id` is the one NOT NULL identity column in
   * this schema and the cast was the only thing standing between it and an undefined — narrowing
   * costs nothing and makes the compiler enforce what the model note claims.
   */
  const storablePaths = consentedVisitorId
    ? (cursorPaths ?? []).map((path: CursorPathInput) => ({
        sessionId,
        visitorId: consentedVisitorId,
        route: path.route,
        section: path.section,
        points: path.points,
        sampleHz: path.sampleHz,
      }))
    : [];

  if ((cursorPaths?.length ?? 0) > 0 && !consentedVisitorId) {
    console.warn("[journey] dropped cursor paths: the batch carried no consented visitor");
  }

  try {
    await prisma.$transaction([
      prisma.journeyEvent.createMany({
        data: events.map((event) => toEventRow(event, parsed.data.schemaVersion)),
      }),
      prisma.journeyCursorGrid.createMany({
        data: storableGrids.map((grid) => ({
          sessionId,
          route: grid.route,
          section: grid.section,
          cells: grid.cells,
          observedMs: grid.observedMs,
        })),
      }),
      prisma.journeyCursorPath.createMany({ data: storablePaths }),
    ]);
  } catch (error) {
    console.warn(
      `[journey] could not store a batch: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  return new NextResponse(null, { status: 204 });
}

function isTierMismatch(event: JourneyEventInput): boolean {
  return event.tier === 1 && typeof event.visitorId === "string";
}

function toEventRow(event: JourneyEventInput, schemaVersion: number) {
  const {
    name,
    occurredAt,
    sessionId,
    visitorId,
    tier,
    route,
    // ⚠ `section` is promoted to a column because the section funnel groups by it; everything else
    // stays in `detail`. Pulled out here so it does not appear in both places and disagree.
    section,
    ...detail
  } = event as JourneyEventInput & { section?: unknown };

  return {
    name,
    // The browser's clock, stored untrusted. `receivedAt` defaults to now() and is what reports use.
    occurredAt: new Date(occurredAt),
    sessionId,
    visitorId: visitorId ?? null,
    tier,
    route,
    section: typeof section === "string" ? section.slice(0, 32) : null,
    /**
     * ⚠ The cast is safe and the reason is worth stating rather than suppressing.
     *
     * Zod's `.passthrough()` types the surplus keys as `unknown`, which Prisma's `InputJsonValue`
     * rightly refuses — `unknown` could be a function or a `Date`, neither of which survives a round
     * trip through JSON. Here it cannot be either: this object came out of `request.json()` three
     * function calls ago, so every value in it is by construction already a JSON primitive. The cast
     * asserts a fact the type system lost rather than one we are hoping for.
     */
    detail:
      Object.keys(detail).length > 0 ? (detail as Prisma.InputJsonValue) : undefined,
    schemaVersion,
  };
}

export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

import { NextResponse } from "next/server";

import { forgetVisitor } from "@/lib/journey/maintenance";
import { isEqualInConstantTime } from "@/lib/sharedSecret";

/**
 * Withdrawal — erase everything that can point at one consented visitor.
 *
 * ── ⚠ THIS IS WHAT MAKES THE CONSENT CONTROL TRUE ──────────────────────────────────────────────
 * The privacy notice says turning it off deletes the identifier immediately. Clearing localStorage
 * alone would honour that only on the visitor's own machine while the server kept every cursor path
 * they ever produced — which would make the sentence false in the only place it matters.
 *
 * ⚠ Public, like the intake, and for the same mechanical reason: it is called by the website on the
 * visitor's behalf. It is on `PUBLIC_PATHS`.
 *
 * ── ⚠ THE VISITOR ID IS THE ONLY CREDENTIAL, AND THAT IS ACCEPTABLE HERE ───────────────────────
 * Anyone who knows a v4 UUID can erase the data behind it. That is fine, and deliberately so: the
 * id is unguessable, it is not a login, and the worst an attacker achieves by guessing one is
 * DELETING analytics about a stranger. Erasure is the privacy-preserving direction — an endpoint
 * where the failure mode is "too much data was destroyed" does not need to be defended like one
 * where the failure mode is disclosure.
 *
 * The shared secret is still required so this cannot be hammered from anywhere but the site.
 */
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const configuredSecret = process.env.LEADS_INTAKE_SECRET;

  if (!configuredSecret) {
    console.warn("[journey] LEADS_INTAKE_SECRET is unset — cannot honour a withdrawal");
    return new NextResponse(null, { status: 204 });
  }

  const provided = request.headers.get("x-voidix-secret");

  if (!provided || !isEqualInConstantTime(provided, configuredSecret)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const visitorId = (body as { visitorId?: unknown })?.visitorId;

  if (typeof visitorId !== "string" || !UUID_PATTERN.test(visitorId)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const result = await forgetVisitor(visitorId);
    console.info(
      `[journey] withdrawal honoured: deleted ${result.paths} paths, anonymised ${result.events} events`,
    );
  } catch (error) {
    // ⚠ Logged loudly. Every other failure in this system costs a count; this one leaves data
    // somebody has explicitly asked to have removed, which is the only failure here worth an alert.
    console.error(
      `[journey] WITHDRAWAL FAILED for a visitor: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

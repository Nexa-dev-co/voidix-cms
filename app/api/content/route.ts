import { NextResponse } from "next/server";

import { parseReleasePayload } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";
import { isEqualInConstantTime } from "@/lib/sharedSecret";

/**
 * The site's read side — the newest release, as one JSON document.
 *
 * ⚠ WHY THIS ROUTE EXISTS RATHER THAN THE SITE READING THE DATABASE. `content_releases` is
 * RLS deny-all with the `anon` and `authenticated` grants revoked (see the
 * `20260728000001_enable_rls` migration), so the Supabase anon key cannot read it — by design,
 * because that key ships to browsers. The alternatives were to write a SELECT policy opening the
 * table to anyone holding that key, or to hand the site `SUPABASE_SERVICE_ROLE_KEY`, which
 * bypasses RLS on *every* table including the leads pipeline. A shared-secret read endpoint gives
 * the site exactly the published copy and nothing else, and costs it no database dependency at
 * all — the site is a Next app with no Prisma, no Supabase client and no connection string.
 *
 * ⚠ It reads the RELEASE, never the draft tables. That is the same contract publishing was built
 * on: one row, one query, atomically consistent, and it cannot catch an editor mid-sentence.
 *
 * The third unauthenticated route, and it carries the same obligation as the two intake ones: it
 * is exempted in `proxy.ts`, so nothing upstream checks on its behalf, and it **fails closed** —
 * with no `CONTENT_READ_SECRET` set it rejects everything rather than serving the site's copy to
 * whoever asks. Its own secret rather than `LEADS_INTAKE_SECRET`: reading published copy and
 * writing into the leads tables are different powers and should not be one key.
 *
 * It deliberately does NOT go through `checkIntakeAllowed`. That guard counts every allowed call
 * against the per-IP submission budget, and a site rebuilding on a schedule would quietly eat the
 * allowance a real visitor's enquiry needs.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSecret = process.env.CONTENT_READ_SECRET;

  if (!configuredSecret) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const providedSecret = request.headers.get("x-voidix-secret");

  if (!providedSecret || !isEqualInConstantTime(providedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  // One query for the row and its payload together, deliberately: reading the metadata and the
  // payload separately leaves a window where a publish lands between them and the site is handed
  // version N's number with version N+1's copy.
  const release = await prisma.contentRelease.findFirst({
    orderBy: { version: "desc" },
    select: { version: true, publishedAt: true, payload: true },
  });

  const payload = release ? parseReleasePayload(release.payload) : null;

  if (!release || !payload) {
    // 404 rather than an empty payload, so the site can tell "nothing has been published yet"
    // from "everything published is empty" and fall back to its own source copy for the first,
    // which is exactly the state a fresh install is in.
    return NextResponse.json({ error: "No release has been published yet." }, { status: 404 });
  }

  return NextResponse.json(
    {
      version: release.version,
      publishedAt: release.publishedAt.toISOString(),
      payload,
    },
    {
      // The site does its own caching (ISR, invalidated by the publish ping). Anything caching
      // in between would put a second, slower clock on the same content and make a publish look
      // like it did nothing.
      headers: { "cache-control": "no-store" },
    },
  );
}

export function POST() {
  return NextResponse.json(
    { error: "This endpoint accepts GET only." },
    { status: 405, headers: { allow: "GET" } },
  );
}

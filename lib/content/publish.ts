import type { Prisma } from "@/generated/prisma/client";
import { buildContentPayload, parseReleasePayload, type ContentPayload } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

const REVALIDATE_TIMEOUT_MS = 10_000;

export type RevalidateStatus = "skipped" | "ok" | "failed";

export interface PublishResult {
  version: number;
  revalidateStatus: RevalidateStatus;
  revalidateDetail: string | null;
}

/**
 * Snapshots the current draft into a new release, then tells the site to rebuild.
 *
 * Publishing is append-only — it never edits an earlier release — so the history stays a
 * true record of what the site served and when.
 */
export async function publishRelease(options: {
  publishedBy: string | null;
  note: string | null;
}): Promise<PublishResult> {
  const payload = await buildContentPayload();

  const latestRelease = await prisma.contentRelease.findFirst({
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const version = (latestRelease?.version ?? 0) + 1;

  const release = await prisma.contentRelease.create({
    data: {
      version,
      // A declared interface has no index signature, which is all Prisma's `InputJsonValue`
      // is asking for — the payload is plain strings and arrays and serialises cleanly.
      payload: payload as unknown as Prisma.InputJsonObject,
      note: options.note,
      publishedBy: options.publishedBy,
      revalidateStatus: "skipped",
    },
  });

  // The release row is written before the site is pinged, deliberately: if the webhook is
  // down, the content is still published and the ping can be retried. The reverse order
  // would let a network blip lose the release.
  const revalidation = await pingSiteRevalidate();

  await prisma.contentRelease.update({
    where: { id: release.id },
    data: {
      revalidateStatus: revalidation.status,
      revalidateDetail: revalidation.detail,
    },
  });

  return {
    version,
    revalidateStatus: revalidation.status,
    revalidateDetail: revalidation.detail,
  };
}

/**
 * Pings the site's revalidate endpoint so the next visitor gets a rebuilt page.
 *
 * The site is not wired up to this CMS yet, so with no `SITE_REVALIDATE_URL` set this is a
 * no-op that records "skipped" — publishing still works, the content just sits in the
 * database waiting for the site to start reading it.
 */
async function pingSiteRevalidate(): Promise<{ status: RevalidateStatus; detail: string | null }> {
  const revalidateUrl = process.env.SITE_REVALIDATE_URL;
  const revalidateSecret = process.env.SITE_REVALIDATE_SECRET;

  if (!revalidateUrl) {
    return {
      status: "skipped",
      detail: "SITE_REVALIDATE_URL is not set — the site is not wired to this CMS yet.",
    };
  }

  try {
    const response = await fetch(revalidateUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(revalidateSecret ? { authorization: `Bearer ${revalidateSecret}` } : {}),
      },
      body: JSON.stringify({ source: "voidix-cms" }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "failed",
        detail: `Site responded ${response.status} ${response.statusText}.`,
      };
    }

    return { status: "ok", detail: null };
  } catch (error) {
    return {
      status: "failed",
      detail: error instanceof Error ? error.message : "Unknown error contacting the site.",
    };
  }
}

/**
 * The payload the site last received, or `null` if nothing has ever been published.
 */
export async function getLatestReleasePayload(): Promise<ContentPayload | null> {
  const release = await prisma.contentRelease.findFirst({
    orderBy: { version: "desc" },
    select: { payload: true },
  });

  return release ? parseReleasePayload(release.payload) : null;
}

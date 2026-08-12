import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { isEqualInConstantTime } from "@/lib/sharedSecret";

const DEFAULT_RATE_LIMIT_PER_HOUR = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * The honeypot field name the site's form must render, hidden, and leave empty.
 *
 * Named to look worth filling in. Bots that fill every input they find will populate it;
 * a human never sees it. Cheap, and it catches the naive majority.
 */
export const HONEYPOT_FIELD = "website";

export type IntakeRejection =
  | "not-configured"
  | "bad-secret"
  | "bad-origin"
  | "rate-limited"
  | "honeypot";

/**
 * Checks whether a request is allowed to submit a lead.
 *
 * **Fails closed.** With no `LEADS_INTAKE_SECRET` configured this rejects everything rather
 * than waving requests through — an endpoint nobody has finished setting up should be shut,
 * not open. That is the difference between "not wired yet" and "unauthenticated write
 * endpoint on the public internet".
 *
 * A note on where the secret can live: this only protects you if the site calls this endpoint
 * **from its own server** (a route handler or server action). If the site's contact form
 * posts to this URL directly from the browser, the secret ships to every visitor and is worth
 * nothing — origin checking, rate limiting and the honeypot become the only real defences.
 */
export async function checkIntakeAllowed(request: Request, honeypotValue: string | null) {
  const configuredSecret = process.env.LEADS_INTAKE_SECRET;

  if (!configuredSecret) {
    return { allowed: false, reason: "not-configured" as IntakeRejection };
  }

  const providedSecret = request.headers.get("x-voidix-secret");

  if (!providedSecret || !isEqualInConstantTime(providedSecret, configuredSecret)) {
    return { allowed: false, reason: "bad-secret" as IntakeRejection };
  }

  if (!isOriginAllowed(request)) {
    return { allowed: false, reason: "bad-origin" as IntakeRejection };
  }

  // Silently accepted below, not rejected loudly — a bot that learns which field betrayed it
  // just stops filling that field in.
  if (honeypotValue && honeypotValue.trim().length > 0) {
    return { allowed: false, reason: "honeypot" as IntakeRejection };
  }

  const ipHash = hashClientIp(request);

  if (ipHash && (await isRateLimited(ipHash))) {
    return { allowed: false, reason: "rate-limited" as IntakeRejection };
  }

  return { allowed: true as const, ipHash };
}

/**
 * Allowed origins, comma separated in `LEADS_ALLOWED_ORIGINS`.
 *
 * Unset means "don't check", which is deliberate: server-to-server calls often send no
 * Origin header at all, so requiring one would break the intended integration. The secret is
 * the real gate; this narrows the blast radius if it leaks into a browser bundle.
 */
function isOriginAllowed(request: Request): boolean {
  const allowList = (process.env.LEADS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowList.length === 0) {
    return true;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return allowList.includes(origin);
}

/**
 * Salted hash of the caller's IP — enough to count submissions per address, not enough to
 * recover the address. Storing raw IPs alongside names and emails would make this table
 * considerably more sensitive than it needs to be for the one job the value has.
 */
function hashClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp?.trim();

  if (!clientIp) {
    return null;
  }

  const salt = process.env.LEADS_IP_SALT ?? "";

  return createHash("sha256").update(`${salt}:${clientIp}`).digest("hex");
}

/**
 * Counts everything the public routes have written from the same hashed IP inside the window.
 *
 * ⚠ COUNTS `submissions` AND `career_applications`, not `enquiries`. It used to count enquiries,
 * which was right when the website form created a contact and an enquiry directly. It no longer
 * does — the form writes to `submissions` and nothing else — so counting enquiries would have
 * left the limiter reading zero forever and the endpoint effectively unlimited. A rate limit
 * that silently stops counting is worse than none, because nothing looks broken.
 *
 * Both tables are counted against one budget on purpose: they share a guard, an attacker does
 * not care which of the two they flood, and two separate allowances would simply double what one
 * address can send.
 *
 * Counting rows rather than keeping a counter table means no extra schema and no state to
 * expire, and because every accepted request writes a row, a flood is caught by the same
 * mechanism that records it. The tradeoff is that rejected attempts don't count toward the
 * limit; they also don't write to the database, so they cost far less.
 */
async function isRateLimited(ipHash: string): Promise<boolean> {
  const limit = Number(process.env.LEADS_RATE_LIMIT_PER_HOUR ?? DEFAULT_RATE_LIMIT_PER_HOUR);

  if (!Number.isFinite(limit) || limit <= 0) {
    return false;
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const [submissionCount, applicationCount] = await Promise.all([
    prisma.submission.count({ where: { ipHash, createdAt: { gte: since } } }),
    prisma.careerApplication.count({ where: { ipHash, createdAt: { gte: since } } }),
  ]);

  return submissionCount + applicationCount >= limit;
}

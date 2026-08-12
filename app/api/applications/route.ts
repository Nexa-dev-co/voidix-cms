import { NextResponse } from "next/server";

import { checkIntakeAllowed, HONEYPOT_FIELD } from "@/lib/leads/intake";
import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/validation/contactSchemas";
import { applicationIntakeSchema } from "@/lib/validation/contentSchemas";

export const dynamic = "force-dynamic";

const USER_AGENT_MAX_LENGTH = 500;
/** What an open application is filed under when no role is named. */
const OPEN_APPLICATION_TITLE = "Open application";

/**
 * The careers form.
 *
 * ⚠ Nothing here touches `contacts`. A candidate is not a lead — the two have opposite
 * relationships to the studio — and a CV is far more sensitive than an enquiry. Applications
 * live in their own table, are admin-only, and are never promoted into the pipeline.
 *
 * ⚠ NO FILE EVER REACHES THIS APP. The site uploads the CV to UploadThing and sends us the URL
 * it gets back, so `cvUrl` is a link like any other and this route needs no multipart handling,
 * no size gate beyond a string length, and no storage.
 *
 * Shares the intake guard with the submissions route: same secret, same origin allowlist, same
 * honeypot, same rate limit, and it fails closed when unconfigured. A second public route is a
 * second obligation, not a second set of rules.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const honeypotValue = typeof payload[HONEYPOT_FIELD] === "string" ? payload[HONEYPOT_FIELD] : null;

  const intakeCheck = await checkIntakeAllowed(request, honeypotValue);

  if (!intakeCheck.allowed) {
    if (intakeCheck.reason === "rate-limited") {
      return NextResponse.json({ error: "Too many submissions." }, { status: 429 });
    }

    if (intakeCheck.reason === "honeypot") {
      return NextResponse.json({ ok: true }, { status: 202 });
    }

    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const parsed = applicationIntakeSchema.safeParse({
    name: payload.name ?? "",
    email: payload.email ?? "",
    phone: payload.phone ?? undefined,
    whyYou: payload.whyYou ?? "",
    workLink: payload.workLink ?? undefined,
    cvUrl: payload.cvUrl ?? undefined,
    roleSlug: payload.roleSlug ?? undefined,
    commitment: payload.commitment ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Some fields need fixing.",
        fields: Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
        ),
      },
      { status: 422 },
    );
  }

  const { name, phone, whyYou, workLink, cvUrl, roleSlug, commitment } = parsed.data;

  // An unknown slug is recorded as an open application rather than rejected. The alternative
  // loses a real person's application because a role was closed between them opening the page
  // and pressing send — which is exactly the window a job posting is most likely to close in.
  const role = roleSlug
    ? await prisma.careerRole.findUnique({ where: { slug: roleSlug }, select: { id: true, title: true } })
    : null;

  const application = await prisma.careerApplication.create({
    data: {
      name,
      email: normaliseEmail(parsed.data.email),
      phone: phone && phone.length > 0 ? phone : null,
      whyYou,
      workLink: workLink && workLink.length > 0 ? workLink : null,
      cvUrl: cvUrl && cvUrl.length > 0 ? cvUrl : null,
      roleId: role?.id ?? null,
      // Snapshotted, so the application still says what it was for after the role is deleted —
      // and deleting the role is how a role is closed.
      roleTitle: role?.title ?? OPEN_APPLICATION_TITLE,
      // Only an open application is asked what it is looking for; a posted role states its own
      // terms, so a commitment arriving alongside a real role is dropped rather than stored.
      commitment: !role && commitment && commitment.length > 0 ? commitment : null,
      ipHash: intakeCheck.ipHash ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}

export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

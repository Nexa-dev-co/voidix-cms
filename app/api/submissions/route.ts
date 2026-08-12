import { NextResponse } from "next/server";

import { checkIntakeAllowed, HONEYPOT_FIELD } from "@/lib/leads/intake";
import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/validation/contactSchemas";
import { submissionIntakeSchema } from "@/lib/validation/contentSchemas";

// One of two routes reachable without logging in. Both are exempted in proxy.ts, so any change
// to their auth story has to be made here — nothing upstream is checking on their behalf.
export const dynamic = "force-dynamic";

const USER_AGENT_MAX_LENGTH = 500;

/**
 * The site's enquiry form.
 *
 * ⚠ THIS NO LONGER CREATES A LEAD, and the difference is the whole point of the inbox. It used
 * to create a `Contact` the moment a form was submitted, which put every bot, every test post
 * and every "hi" straight into the pipeline, the counts and the reports. It now writes one row
 * to `submissions` and stops. An admin decides what becomes a contact, and `promoteSubmission`
 * is the only path that does it.
 *
 * That also means no deduplication happens here. Matching a submission to a person is a decision
 * about people and it is made at promotion time, where there is somebody to see the answer.
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
    // Every rejection returns the same shape and, where it can, the same status. A caller
    // probing this endpoint shouldn't be able to tell a wrong secret from a blocked origin
    // from a tripped honeypot — that difference is a map of the defences.
    if (intakeCheck.reason === "rate-limited") {
      return NextResponse.json({ error: "Too many submissions." }, { status: 429 });
    }

    if (intakeCheck.reason === "honeypot") {
      // Answer a bot with success. Telling it that it was caught just teaches it to leave the
      // field alone next time; nothing is stored either way.
      return NextResponse.json({ ok: true }, { status: 202 });
    }

    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const parsed = submissionIntakeSchema.safeParse({
    name: payload.name ?? undefined,
    email: payload.email ?? "",
    company: payload.company ?? undefined,
    message: payload.message ?? undefined,
    phone: payload.phone ?? undefined,
    source: payload.source ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Some fields need fixing.",
        // Safe to return: these are the messages from our own schema, not database detail.
        fields: Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
        ),
      },
      { status: 422 },
    );
  }

  const { name, company, message, phone, source } = parsed.data;

  // An omitted field and a field submitted empty are the same fact — "they did not tell us this" —
  // so both land as null rather than one of them becoming an empty string that reads as a value.
  const orNull = (value: string | undefined) => (value && value.length > 0 ? value : null);

  const submission = await prisma.submission.create({
    data: {
      name: orNull(name),
      // Normalised even though nothing here is unique, so that matching it against
      // `contacts.email` at promotion compares like with like.
      email: normaliseEmail(parsed.data.email),
      company: orNull(company),
      message: orNull(message),
      phone: orNull(phone),
      source: orNull(source),
      ipHash: intakeCheck.ipHash ?? null,
      userAgent: request.headers.get("user-agent")?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: submission.id }, { status: 201 });
}

// A GET here would be a plausible mistake to make later, so it is answered explicitly rather
// than falling through to a 405 that looks like the route is broken.
export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

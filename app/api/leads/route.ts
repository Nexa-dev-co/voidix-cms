import { NextResponse } from "next/server";

import { EnquirySource } from "@/generated/prisma/enums";
import { checkIntakeAllowed, HONEYPOT_FIELD } from "@/lib/leads/intake";
import { originColumns } from "@/lib/leads/leadOrigin";
import { pickAutoAssignee } from "@/lib/leads/leadSettings";
import { getDefaultStage } from "@/lib/leads/pipeline";
import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/validation/contactSchemas";
import { leadIntakeSchema } from "@/lib/validation/contentSchemas";

// The only route in this app reachable without logging in. It is exempted in proxy.ts, so any
// change to its auth story has to be made here — nothing upstream is checking on its behalf.
export const dynamic = "force-dynamic";

const USER_AGENT_MAX_LENGTH = 500;

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

  const parsed = leadIntakeSchema.safeParse({
    name: payload.name ?? "",
    email: payload.email ?? "",
    company: payload.company ?? undefined,
    message: payload.message ?? "",
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

  // `source` is the site's own label for where the submission came from — a page name, a
  // campaign. The schema has always accepted it; until now the route parsed it and dropped it on
  // the floor, so every website lead looked identical to every other one.
  const { name, company, message, source } = parsed.data;
  const email = normaliseEmail(parsed.data.email);
  const userAgent = request.headers.get("user-agent")?.slice(0, USER_AGENT_MAX_LENGTH) ?? null;

  // Someone enquiring a second time is not a duplicate — it's the same person with more to
  // say, and often the most interesting thing in the list. The enquiry is appended to their
  // existing record so both messages survive and only one salesperson owns the relationship.
  const existing = await prisma.contact.findUnique({
    where: { email },
    select: { id: true, company: true },
  });

  if (existing) {
    await prisma.enquiry.create({
      data: {
        contactId: existing.id,
        source: EnquirySource.CONTACT_FORM,
        message,
        ipHash: intakeCheck.ipHash ?? null,
        userAgent,
      },
    });

    // Fill a gap if they supplied something we lacked, but never overwrite — the record may
    // have been corrected by hand, and an anonymous form post shouldn't undo that.
    if (!existing.company && company) {
      await prisma.contact.update({ where: { id: existing.id }, data: { company } });
    }

    return NextResponse.json({ ok: true, id: existing.id }, { status: 201 });
  }

  // Routing is a policy decision an admin makes under Settings, not something the intake
  // endpoint should hardcode. Returns null when nothing applies, leaving the lead unassigned.
  const assignedToId = await pickAutoAssignee();

  // Somebody who just filled in the form has by definition not been worked yet, so they land in
  // the first stage. This endpoint stays deliberately narrow — name, email, message — and never
  // accepts custom fields: those are internal sales notes, and the one route on the public
  // internet should not be a way to write into them.
  const defaultStage = await getDefaultStage();

  const contact = await prisma.contact.create({
    data: {
      name,
      email,
      company: company && company.length > 0 ? company : null,
      stageId: defaultStage.id,
      assignedToId,
      assignedAt: assignedToId ? new Date() : null,
      // Nobody added this lead, so there is no member to record — only the channel and whatever
      // the site chose to tag the submission with.
      ...originColumns({ via: "CONTACT_FORM", label: source ?? null }),
      enquiries: {
        create: [
          {
            source: EnquirySource.CONTACT_FORM,
            message,
            ipHash: intakeCheck.ipHash ?? null,
            userAgent,
          },
        ],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: contact.id }, { status: 201 });
}

// A GET here would be a plausible mistake to make later, so it is answered explicitly rather
// than falling through to a 405 that looks like the route is broken.
export function GET() {
  return NextResponse.json(
    { error: "This endpoint accepts POST only." },
    { status: 405, headers: { allow: "POST" } },
  );
}

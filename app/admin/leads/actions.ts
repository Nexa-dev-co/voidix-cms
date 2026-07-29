"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EnquirySource, LeadStatus } from "@/generated/prisma/enums";
import { requireAdmin, requireMember, type CurrentMember } from "@/lib/auth";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { canViewContact } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";
import {
  attemptSchema,
  contactNotesSchema,
  contactRecordSchema,
} from "@/lib/validation/contactSchemas";

function revalidateLeads(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  if (id) {
    revalidatePath(`/admin/leads/${id}`);
  }
}

function parseStatus(value: FormDataEntryValue | null): LeadStatus | null {
  const candidate = String(value ?? "");

  return candidate === LeadStatus.NEW ||
    candidate === LeadStatus.READ ||
    candidate === LeadStatus.ARCHIVED
    ? (candidate as LeadStatus)
    : null;
}

/**
 * Adds a contact by hand.
 *
 * Follows the same rule as the importer and the intake endpoint: an email that already exists
 * never creates a second row. It appends an enquiry to the person who is already there, so a
 * salesperson typing in someone who enquired last month sees the history rather than starting
 * a parallel record.
 */
export async function createContactAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const member = await requireMember();

  const parsed = contactRecordSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    company: formData.get("company") ?? "",
    phone: formData.get("phone") ?? "",
    message: formData.get("message") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { name, email, company, phone, message } = parsed.data;

  const existing = await prisma.contact.findUnique({ where: { email } });

  if (existing) {
    await prisma.enquiry.create({
      data: {
        contactId: existing.id,
        source: EnquirySource.MANUAL,
        message,
      },
    });

    // Fill gaps without touching anything already filled in — the person on the record may
    // have been corrected by hand, and a re-entry shouldn't undo that.
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        company: existing.company ?? company,
        phone: existing.phone ?? phone,
      },
    });

    revalidateLeads(existing.id);
    redirect(`/admin/leads/${existing.id}?merged=1`);
  }

  const contact = await prisma.contact.create({
    data: {
      name,
      email,
      company,
      phone,
      assignedToId: member.id,
      assignedAt: new Date(),
      enquiries: { create: [{ source: EnquirySource.MANUAL, message }] },
    },
  });

  revalidateLeads();
  redirect(`/admin/leads/${contact.id}`);
}

/**
 * Loads a contact only if this person is allowed to touch it.
 *
 * Every mutating action runs this first. Filtering the list is presentation; a Server Action
 * is a POST endpoint that accepts any id it is given, so without this a salesperson could
 * modify a lead belonging to someone else simply by posting its id.
 */
async function loadPermittedContact(member: CurrentMember, id: string) {
  if (!id) {
    return null;
  }

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { id: true, assignedToId: true },
  });

  if (!contact || !(await canViewContact(member, contact))) {
    return null;
  }

  return contact;
}

export async function setContactStatusAction(formData: FormData) {
  const member = await requireMember();

  const id = String(formData.get("id") ?? "");
  const status = parseStatus(formData.get("status"));

  if (!status || !(await loadPermittedContact(member, id))) {
    return;
  }

  await prisma.contact.update({ where: { id }, data: { status } });

  revalidateLeads(id);
}

export async function assignContactAction(formData: FormData) {
  const member = await requireMember();

  const id = String(formData.get("id") ?? "");
  const rawMemberId = String(formData.get("assignedToId") ?? "");
  const assignedToId = rawMemberId.length > 0 ? rawMemberId : null;

  const contact = await loadPermittedContact(member, id);

  if (!contact) {
    return;
  }

  // Sales cannot hand leads around. The one move they may make is claiming an unassigned
  // lead for themselves, and only when an admin has enabled that.
  if (member.role !== "ADMIN") {
    const settings = await getLeadSettings();
    const isSelfClaim = contact.assignedToId === null && assignedToId === member.id;

    if (!isSelfClaim || !settings.salesCanClaimUnassigned) {
      return;
    }
  }

  await prisma.contact.update({
    where: { id },
    data: { assignedToId, assignedAt: assignedToId ? new Date() : null },
  });

  revalidateLeads(id);
}

/** Records an attempt to reach a contact. */
export async function logAttemptAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const member = await requireMember();

  const contactId = String(formData.get("contactId") ?? "");

  if (!(await loadPermittedContact(member, contactId))) {
    return formError("That lead isn't yours to update.");
  }

  const parsed = attemptSchema.safeParse({
    channel: formData.get("channel") ?? "",
    outcome: formData.get("outcome") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  await prisma.contactAttempt.create({
    data: {
      contactId,
      memberId: member.id,
      // Snapshot the name so history stays attributable if the member is later removed.
      memberName: member.name,
      channel: parsed.data.channel,
      outcome: parsed.data.outcome,
      note: parsed.data.note,
    },
  });

  // Reaching out means it has been looked at — saves a second click on the status buttons.
  await prisma.contact.updateMany({
    where: { id: contactId, status: LeadStatus.NEW },
    data: { status: LeadStatus.READ },
  });

  revalidateLeads(contactId);

  return formSuccess("Attempt logged.");
}

export async function saveContactNotesAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const member = await requireMember();

  const id = String(formData.get("id") ?? "");

  if (!(await loadPermittedContact(member, id))) {
    return formError("That lead isn't yours to update.");
  }

  const parsed = contactNotesSchema.safeParse(String(formData.get("notes") ?? ""));

  if (!parsed.success) {
    return formError(parsed.error.issues[0]?.message ?? "Those notes are too long.");
  }

  await prisma.contact.update({
    where: { id },
    data: { notes: parsed.data.length > 0 ? parsed.data : null },
  });

  revalidateLeads(id);

  return formSuccess("Notes saved.");
}

/**
 * Admin only. Deleting takes the person's whole history with it, which is the right outcome
 * for an erasure request and the wrong one for a salesperson tidying their list — archiving
 * is what that wants, and every role can do that.
 */
export async function deleteContactAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.contact.delete({ where: { id } });

  revalidateLeads();
  redirect("/admin/leads");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EnquirySource, TeamRole } from "@/generated/prisma/enums";
import { requireAdmin, requireMember, type CurrentMember } from "@/lib/auth";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { getActiveFieldDefinitions, writeCustomFieldValues } from "@/lib/leads/customFields";
import { CUSTOM_FIELD_INPUT_PREFIX } from "@/lib/leads/customFieldTypes";
import {
  addDays,
  parseFollowUpDate,
  resolveQuickFollowUp,
  toFollowUpInputValue,
} from "@/lib/leads/followUp";
import { originColumns } from "@/lib/leads/leadOrigin";
import { getAttemptVocabulary, getLeadSettings } from "@/lib/leads/leadSettings";
import { UNASSIGN_SENTINEL } from "@/lib/leads/leadsView";
import { canMoveToStage, getDefaultStage } from "@/lib/leads/pipeline";
import { canEditContactDetails, canViewContact } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";
import {
  contactNotesSchema,
  contactRecordSchema,
  followUpSchema,
} from "@/lib/validation/contactSchemas";

function revalidateLeads(id?: string) {
  revalidatePath("/");
  revalidatePath("/leads");
  if (id) {
    revalidatePath(`/leads/${id}`);
  }
}

/**
 * Loads a contact only if this person is allowed to touch it.
 *
 * Every mutating action runs this first. Filtering the list is presentation; a Server Action is a
 * POST endpoint that accepts any id it is given, so without this a salesperson could modify a
 * lead belonging to someone else simply by posting its id.
 */
async function loadPermittedContact(member: CurrentMember, id: string) {
  if (!id) {
    return null;
  }

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
      assignedToId: true,
      stageId: true,
      stage: { select: { id: true, label: true, kind: true } },
    },
  });

  if (!contact || !(await canViewContact(member, contact))) {
    return null;
  }

  return contact;
}

/**
 * Adds a contact by hand.
 *
 * Follows the same rule as the importer and the intake endpoint: an email that already exists
 * never creates a second row. It appends an enquiry to the person who is already there, so a
 * salesperson typing in someone who enquired last month sees the history rather than starting a
 * parallel record.
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
      data: { contactId: existing.id, source: EnquirySource.MANUAL, message },
    });

    // Fill gaps without touching anything already filled in — the person on the record may have
    // been corrected by hand, and a re-entry shouldn't undo that.
    await prisma.contact.update({
      where: { id: existing.id },
      data: { company: existing.company ?? company, phone: existing.phone ?? phone },
    });

    revalidateLeads(existing.id);
    redirect(`/leads/${existing.id}?merged=1`);
  }

  const defaultStage = await getDefaultStage();

  const contact = await prisma.contact.create({
    data: {
      name,
      email,
      company,
      phone,
      stageId: defaultStage.id,
      assignedToId: member.id,
      assignedAt: new Date(),
      // Who typed this in, which was not recorded anywhere before — `assignedToId` says who owns
      // the lead now, and a lead handed to someone else the next day loses that answer.
      ...originColumns({ via: "MANUAL", member: { id: member.id, name: member.name } }),
      enquiries: { create: [{ source: EnquirySource.MANUAL, message }] },
    },
  });

  revalidateLeads();
  redirect(`/leads/${contact.id}`);
}

/**
 * Moves one lead to another stage, from the stage bar or the table.
 *
 * Writes the history row as well as the contact, because "when did this become Qualified?" has to
 * be answerable for moves that never went through the wizard.
 */
export async function setContactStageAction(formData: FormData) {
  const member = await requireMember();

  const id = String(formData.get("id") ?? "");
  const stageId = String(formData.get("stageId") ?? "");

  const contact = await loadPermittedContact(member, id);

  if (!contact || !stageId || contact.stageId === stageId) {
    return;
  }

  const stage = await prisma.pipelineStage.findUnique({
    where: { id: stageId },
    select: { id: true, label: true, kind: true },
  });

  if (!stage || !(await canMoveToStage(member, stage))) {
    return;
  }

  await prisma.$transaction([
    prisma.contact.update({ where: { id }, data: { stageId: stage.id } }),
    prisma.contactStageChange.create({
      data: {
        contactId: id,
        memberId: member.id,
        memberName: member.name,
        fromStage: contact.stage.label,
        toStage: stage.label,
      },
    }),
  ]);

  revalidateLeads(id);
}

export async function setContactArchivedAction(formData: FormData) {
  const member = await requireMember();

  const id = String(formData.get("id") ?? "");
  const isArchived = String(formData.get("isArchived") ?? "") === "true";

  if (!(await loadPermittedContact(member, id))) {
    return;
  }

  await prisma.contact.update({ where: { id }, data: { isArchived } });

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

  // Sales cannot hand leads around. The one move they may make is claiming an unassigned lead
  // for themselves, and only when an admin has enabled that.
  if (member.role !== TeamRole.ADMIN) {
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

/**
 * The follow-up wizard's single write.
 *
 * One transaction covering the attempt, the stage move and the next due date: a follow-up where
 * the call was recorded but the lead never moved — or moved without the reason being recorded —
 * is worse than one that failed outright and can be retried.
 */
export async function logFollowUpAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const member = await requireMember();

  const contactId = String(formData.get("contactId") ?? "");
  const contact = await loadPermittedContact(member, contactId);

  if (!contact) {
    return formError("That lead isn't yours to update.");
  }

  const parsed = followUpSchema.safeParse({
    channel: formData.get("channel") ?? "",
    outcome: formData.get("outcome") ?? "",
    note: formData.get("note") ?? "",
    stageId: formData.get("stageId") ?? "",
    nextFollowUpDate: formData.get("nextFollowUpDate") ?? "",
    reason: formData.get("reason") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { channel, outcome, note, stageId, nextFollowUpDate, reason } = parsed.data;

  const nextFollowUpAt = nextFollowUpDate ? parseFollowUpDate(nextFollowUpDate) : null;

  if (nextFollowUpDate && !nextFollowUpAt) {
    return formError("That follow-up date isn't a date.");
  }

  // A stage the caller may not move into is refused outright rather than quietly ignored — the
  // review step promised it would happen, so silently skipping it would be a lie.
  let targetStage: { id: string; label: string } | null = null;

  if (stageId && stageId !== contact.stageId) {
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
      select: { id: true, label: true, kind: true },
    });

    if (!stage) {
      return formError("That stage no longer exists.");
    }

    if (!(await canMoveToStage(member, stage))) {
      return formError("Marking a lead won or lost is an admin's call on this team.");
    }

    targetStage = { id: stage.id, label: stage.label };
  }

  await prisma.$transaction(async (transaction) => {
    const attempt = await transaction.contactAttempt.create({
      data: {
        contactId,
        memberId: member.id,
        // Snapshot the name so history stays attributable if the member is later removed.
        memberName: member.name,
        channel,
        outcome,
        note,
        nextDueAt: nextFollowUpAt,
      },
    });

    if (targetStage) {
      await transaction.contactStageChange.create({
        data: {
          contactId,
          memberId: member.id,
          memberName: member.name,
          fromStage: contact.stage.label,
          toStage: targetStage.label,
          reason,
          attemptId: attempt.id,
        },
      });
    }

    await transaction.contact.update({
      where: { id: contactId },
      data: {
        nextFollowUpAt,
        ...(targetStage ? { stageId: targetStage.id } : {}),
      },
    });
  });

  revalidateLeads(contactId);

  return formSuccess(
    targetStage ? `Logged, and moved to ${targetStage.label}.` : "Follow-up logged.",
  );
}

/**
 * The one-click path for the most common dead end.
 *
 * Records the attempt and pushes the next follow-up, leaving the stage alone — nobody learns
 * anything about a lead from a phone that rang out. The channel and outcome come from the live
 * vocabulary through the same resolver the button label uses, so what it promises and what it
 * writes cannot drift.
 */
export async function quickNoAnswerAction(formData: FormData) {
  const member = await requireMember();

  const contactId = String(formData.get("contactId") ?? "");

  if (!(await loadPermittedContact(member, contactId))) {
    return;
  }

  const vocabulary = await getAttemptVocabulary();
  const quick = resolveQuickFollowUp(vocabulary.channels, vocabulary.outcomes);

  if (!quick) {
    return;
  }

  const nextFollowUpAt = parseFollowUpDate(toFollowUpInputValue(addDays(new Date(), quick.days)));

  await prisma.$transaction([
    prisma.contactAttempt.create({
      data: {
        contactId,
        memberId: member.id,
        memberName: member.name,
        channel: quick.channel,
        outcome: quick.outcome,
        nextDueAt: nextFollowUpAt,
      },
    }),
    prisma.contact.update({ where: { id: contactId }, data: { nextFollowUpAt } }),
  ]);

  revalidateLeads(contactId);
}

export async function saveCustomFieldValuesAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const member = await requireMember();

  const contactId = String(formData.get("contactId") ?? "");

  if (!(await loadPermittedContact(member, contactId))) {
    return formError("That lead isn't yours to update.");
  }

  if (!(await canEditCustomFields(member))) {
    return formError("Editing these fields is an admin's job on this team.");
  }

  const definitions = await getActiveFieldDefinitions();

  const result = await writeCustomFieldValues(contactId, definitions, (definition) =>
    formData.getAll(`${CUSTOM_FIELD_INPUT_PREFIX}${definition.id}`).map((value) => String(value)),
  );

  if (!result.ok) {
    return {
      status: "error",
      message: "Nothing was saved — check the fields below.",
      fieldErrors: result.fieldErrors,
    };
  }

  revalidateLeads(contactId);

  return formSuccess("Saved.");
}

async function canEditCustomFields(member: CurrentMember): Promise<boolean> {
  if (member.role === TeamRole.ADMIN) {
    return true;
  }

  const settings = await getLeadSettings();

  // Both gates apply: the custom-field switch, and the general "may Sales edit a contact at all"
  // one. Turning off contact editing shouldn't leave a side door open through these.
  return settings.salesCanEditCustomFields && (await canEditContactDetails(member));
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
 * Filters a posted list of ids down to the ones this person may actually act on.
 *
 * The bulk bar sends whatever the browser had selected. Rather than failing the whole batch when
 * one id doesn't belong to the caller, the ones they may not touch are dropped — a selection can
 * go stale between rendering and submitting, and a hard error there would be indistinguishable
 * from a bug.
 */
async function filterPermittedIds(member: CurrentMember, ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids } },
    select: { id: true, assignedToId: true },
  });

  const permitted: string[] = [];

  for (const contact of contacts) {
    if (await canViewContact(member, contact)) {
      permitted.push(contact.id);
    }
  }

  return permitted;
}

function readSelectedIds(formData: FormData): string[] {
  return formData
    .getAll("ids")
    .map((value) => String(value))
    .filter((value) => value.length > 0);
}

export async function bulkAssignAction(formData: FormData) {
  const member = await requireMember();

  // Handing leads to someone else is an admin move — Sales claiming an unassigned lead one at a
  // time goes through assignContactAction, which checks the setting for exactly that case.
  if (member.role !== TeamRole.ADMIN) {
    return;
  }

  // An explicit sentinel rather than an empty string: the bulk bar disables its button until
  // something is chosen, so "" has to keep meaning "nothing chosen yet".
  const rawMemberId = String(formData.get("assignedToId") ?? "");
  const assignedToId = rawMemberId === UNASSIGN_SENTINEL || rawMemberId.length === 0 ? null : rawMemberId;
  const ids = await filterPermittedIds(member, readSelectedIds(formData));

  if (rawMemberId.length === 0 || ids.length === 0) {
    return;
  }

  await prisma.contact.updateMany({
    where: { id: { in: ids } },
    data: { assignedToId, assignedAt: assignedToId ? new Date() : null },
  });

  revalidateLeads();
}

export async function bulkStageAction(formData: FormData) {
  const member = await requireMember();

  const stageId = String(formData.get("stageId") ?? "");
  const ids = await filterPermittedIds(member, readSelectedIds(formData));

  if (!stageId || ids.length === 0) {
    return;
  }

  const stage = await prisma.pipelineStage.findUnique({
    where: { id: stageId },
    select: { id: true, label: true, kind: true },
  });

  if (!stage || !(await canMoveToStage(member, stage))) {
    return;
  }

  // Read the stages they are leaving first — after the update there is nothing left to snapshot,
  // and a history row saying "moved from Qualified to Qualified" is worse than none.
  const moving = await prisma.contact.findMany({
    where: { id: { in: ids }, stageId: { not: stage.id } },
    select: { id: true, stage: { select: { label: true } } },
  });

  if (moving.length === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.contact.updateMany({
      where: { id: { in: moving.map((contact) => contact.id) } },
      data: { stageId: stage.id },
    }),
    prisma.contactStageChange.createMany({
      data: moving.map((contact) => ({
        contactId: contact.id,
        memberId: member.id,
        memberName: member.name,
        fromStage: contact.stage.label,
        toStage: stage.label,
      })),
    }),
  ]);

  revalidateLeads();
}

export async function bulkArchiveAction(formData: FormData) {
  const member = await requireMember();

  const isArchived = String(formData.get("isArchived") ?? "true") === "true";
  const ids = await filterPermittedIds(member, readSelectedIds(formData));

  if (ids.length === 0) {
    return;
  }

  await prisma.contact.updateMany({ where: { id: { in: ids } }, data: { isArchived } });

  revalidateLeads();
}

/**
 * Admin only. Deleting takes the person's whole history with it, which is the right outcome for
 * an erasure request and the wrong one for a salesperson tidying their list — archiving is what
 * that wants, and every role can do that.
 */
export async function deleteContactAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.contact.delete({ where: { id } });

  revalidateLeads();
  redirect("/leads");
}

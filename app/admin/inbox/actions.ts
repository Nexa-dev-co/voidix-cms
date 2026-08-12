"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { promoteSubmission } from "@/lib/leads/promoteSubmission";
import { prisma } from "@/lib/prisma";

// Admin-only, every one of them. The inbox holds unvetted messages from the public internet and
// has no owner column, so `visibility.ts` has nothing to scope by — the role is the whole gate.
// These are POST endpoints reachable directly, so the page's guard does not cover them.

function revalidateInbox() {
  revalidatePath("/admin");
  revalidatePath("/admin/inbox");
  // The promoted row shows up as a lead, so that list is stale too.
  revalidatePath("/admin/leads");
}

export async function promoteSubmissionAction(formData: FormData) {
  const member = await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await promoteSubmission(id, member.id);

  revalidateInbox();
}

export async function dismissSubmissionAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // Marked, not deleted: the inbox should be able to show what it has already dealt with, and a
  // dismissed row still proves what arrived. A real delete stays available for anything worse.
  await prisma.submission.updateMany({
    where: { id, promotedAt: null },
    data: { dismissedAt: new Date() },
  });

  revalidateInbox();
}

export async function restoreSubmissionAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.submission.updateMany({ where: { id }, data: { dismissedAt: null } });

  revalidateInbox();
}

export async function deleteSubmissionAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // A real delete, for spam worth removing rather than filing. Promoting first and deleting
  // after would orphan nothing — `promoted_contact_id` is SET NULL — but the contact keeps its
  // enquiry either way, so nothing a salesperson is working on disappears with this.
  await prisma.submission.delete({ where: { id } });

  revalidateInbox();
}

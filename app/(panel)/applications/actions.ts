"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin-only, every one of them. Applications hold CVs, phone numbers and people's reasons for
// wanting to leave their current job — hiring material, not sales material. These are POST
// endpoints reachable directly, so the page's guard does not cover them.

function revalidateApplications() {
  revalidatePath("/");
  revalidatePath("/applications");
}

export async function markApplicationReviewedAction(formData: FormData) {
  const member = await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.careerApplication.updateMany({
    where: { id, reviewedAt: null },
    data: { reviewedAt: new Date(), reviewedById: member.id },
  });

  revalidateApplications();
}

export async function markApplicationUnreviewedAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.careerApplication.updateMany({
    where: { id },
    data: { reviewedAt: null, reviewedById: null },
  });

  revalidateApplications();
}

export async function deleteApplicationAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // A real delete. This is personal data somebody sent us for one purpose, so keeping it
  // indefinitely is the wrong default — and unlike a lead there is no pipeline history to lose.
  // ⚠ The CV itself lives in UploadThing, not here: deleting this row removes our link to the
  // file, not the file. Purging it there is a separate job nobody should assume happened.
  await prisma.careerApplication.delete({ where: { id } });

  revalidateApplications();
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { planReorder, type MoveDirection } from "@/lib/content/reorder";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { faqSchema } from "@/lib/validation/contentSchemas";

function revalidateFaq(id?: string) {
  revalidatePath("/");
  revalidatePath("/faq");
  if (id) {
    revalidatePath(`/faq/${id}`);
  }
}

function parseFaqForm(formData: FormData) {
  return faqSchema.safeParse({
    question: formData.get("question") ?? "",
    answer: formData.get("answer") ?? "",
  });
}

export async function createFaqAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parseFaqForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { question, answer } = parsed.data;

  const highestSortOrder = await prisma.faqEntry.aggregate({ _max: { sortOrder: true } });

  await prisma.faqEntry.create({
    data: {
      question,
      sortOrder: (highestSortOrder._max.sortOrder ?? -1) + 1,
      paragraphs: {
        create: answer.map((body, index) => ({ sortOrder: index, body })),
      },
    },
  });

  revalidateFaq();
  redirect("/faq");
}

export async function updateFaqAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return formError("Missing question id.");
  }

  const parsed = parseFaqForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { question, answer } = parsed.data;

  const existing = await prisma.faqEntry.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    return formError("That question no longer exists.");
  }

  await prisma.$transaction([
    prisma.faqEntry.update({ where: { id }, data: { question } }),
    prisma.faqParagraph.deleteMany({ where: { faqEntryId: id } }),
    prisma.faqParagraph.createMany({
      data: answer.map((body, index) => ({ faqEntryId: id, sortOrder: index, body })),
    }),
  ]);

  revalidateFaq(id);

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

export async function deleteFaqAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.faqEntry.delete({ where: { id } });

  const remaining = await prisma.faqEntry.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((entry, position) =>
      prisma.faqEntry.update({ where: { id: entry.id }, data: { sortOrder: position } }),
    ),
  );

  revalidateFaq();
  redirect("/faq");
}

export async function moveFaqAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "") as MoveDirection;

  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }

  const entries = await prisma.faqEntry.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const updates = planReorder(
    entries.map((entry) => entry.id),
    id,
    direction,
  );

  if (!updates) {
    return;
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.faqEntry.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } }),
    ),
  );

  revalidateFaq();
}

"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { aboutSchema } from "@/lib/validation/contentSchemas";

export async function updateAboutAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = aboutSchema.safeParse({
    eyebrow: formData.get("eyebrow") ?? "",
    titleLine1: formData.get("titleLine1") ?? "",
    titleLine2: formData.get("titleLine2") ?? "",
    lead: formData.get("lead") ?? "",
    premiseParagraphs: formData.get("premiseParagraphs") ?? "",
    premiseQuote: formData.get("premiseQuote") ?? "",
    principles: formData.get("principles") ?? "",
    buildPhases: formData.get("buildPhases") ?? "",
    instruments: formData.get("instruments") ?? "",
    instrumentsNote: formData.get("instrumentsNote") ?? "",
    stack: formData.get("stack") ?? "",
    stackNote: formData.get("stackNote") ?? "",
    closingTitle: formData.get("closingTitle") ?? "",
    closingLead: formData.get("closingLead") ?? "",
    careersInvite: formData.get("careersInvite") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const {
    premiseParagraphs,
    principles,
    buildPhases,
    instruments,
    stack,
    ...page
  } = parsed.data;

  // One transaction, and the child lists are replaced wholesale rather than diffed. These are
  // single-digit lists edited as text, so working out which rows moved would cost more than
  // rewriting them — and a partial apply would leave the page contradicting itself. The same
  // delete-then-create shape the FAQ answer uses.
  await prisma.$transaction([
    prisma.aboutPage.upsert({
      where: { id: SINGLETON_ROW_ID },
      create: { id: SINGLETON_ROW_ID, ...page },
      update: page,
    }),

    prisma.aboutPremiseParagraph.deleteMany({}),
    prisma.aboutPremiseParagraph.createMany({
      data: premiseParagraphs.map((body, index) => ({ sortOrder: index, body })),
    }),

    prisma.aboutPrinciple.deleteMany({}),
    prisma.aboutPrinciple.createMany({
      data: principles.map((principle, index) => ({ sortOrder: index, ...principle })),
    }),

    prisma.aboutBuildPhase.deleteMany({}),
    prisma.aboutBuildPhase.createMany({
      data: buildPhases.map((phase, index) => ({ sortOrder: index, ...phase })),
    }),

    prisma.aboutInstrument.deleteMany({}),
    prisma.aboutInstrument.createMany({
      data: instruments.map((instrument, index) => ({ sortOrder: index, ...instrument })),
    }),

    prisma.aboutStackItem.deleteMany({}),
    prisma.aboutStackItem.createMany({
      data: stack.map((label, index) => ({ sortOrder: index, label })),
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/about");

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

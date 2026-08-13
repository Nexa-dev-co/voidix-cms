"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { CareerRoleBulletKind } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { planReorder, type MoveDirection } from "@/lib/content/reorder";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { makeSlugUnique, slugify } from "@/lib/text/slugify";
import { careerRoleSchema, careersSchema } from "@/lib/validation/contentSchemas";

function revalidateCareers(roleId?: string) {
  revalidatePath("/");
  revalidatePath("/careers");
  if (roleId) {
    revalidatePath(`/careers/roles/${roleId}`);
  }
}

export async function updateCareersAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = careersSchema.safeParse({
    eyebrow: formData.get("eyebrow") ?? "",
    titleLine1: formData.get("titleLine1") ?? "",
    titleLine2: formData.get("titleLine2") ?? "",
    lead: formData.get("lead") ?? "",
    workingHere: formData.get("workingHere") ?? "",
    hiringPhases: formData.get("hiringPhases") ?? "",
    rolesEmptyLine: formData.get("rolesEmptyLine") ?? "",
    rolesEmptyInvite: formData.get("rolesEmptyInvite") ?? "",
    openApplicationTitle: formData.get("openApplicationTitle") ?? "",
    openApplicationLead: formData.get("openApplicationLead") ?? "",
    openApplicationSubject: formData.get("openApplicationSubject") ?? "",
    openApplicationSeed: formData.get("openApplicationSeed") ?? "",
    commitmentLabel: formData.get("commitmentLabel") ?? "",
    commitmentOptions: formData.get("commitmentOptions") ?? "",
    applicationBriefLabel: formData.get("applicationBriefLabel") ?? "",
    applicationSubmitLabel: formData.get("applicationSubmitLabel") ?? "",
    aboutInvite: formData.get("aboutInvite") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { workingHere, hiringPhases, commitmentOptions, ...page } = parsed.data;

  // Child lists replaced wholesale in one transaction, same as the About page — see the note
  // there. Roles are not touched: they have their own pages and their own ordering.
  await prisma.$transaction([
    prisma.careersPage.upsert({
      where: { id: SINGLETON_ROW_ID },
      create: { id: SINGLETON_ROW_ID, ...page },
      update: page,
    }),

    prisma.careersClaim.deleteMany({}),
    prisma.careersClaim.createMany({
      data: workingHere.map((claim, index) => ({ sortOrder: index, ...claim })),
    }),

    prisma.careersHiringPhase.deleteMany({}),
    prisma.careersHiringPhase.createMany({
      data: hiringPhases.map((phase, index) => ({ sortOrder: index, ...phase })),
    }),

    prisma.careersCommitmentOption.deleteMany({}),
    prisma.careersCommitmentOption.createMany({
      data: commitmentOptions.map((label, index) => ({ sortOrder: index, label })),
    }),
  ]);

  revalidateCareers();

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

function parseRoleForm(formData: FormData) {
  return careerRoleSchema.safeParse({
    title: formData.get("title") ?? "",
    location: formData.get("location") ?? "",
    commitment: formData.get("commitment") ?? "",
    owns: formData.get("owns") ?? "",
    needs: formData.get("needs") ?? "",
    bonus: formData.get("bonus") ?? "",
    briefSeed: formData.get("briefSeed") ?? "",
  });
}

/** Flattens the three lists into the single ordered table they share. */
function bulletRows(lists: { owns: string[]; needs: string[]; bonus: string[] }) {
  const kinds: [CareerRoleBulletKind, string[]][] = [
    ["OWNS", lists.owns],
    ["NEEDS", lists.needs],
    ["BONUS", lists.bonus],
  ];

  // `sortOrder` restarts per kind, because the three lists render as three separate lists —
  // one running counter would still read back correctly but would make the numbering in the
  // database meaningless the moment a list changed length.
  return kinds.flatMap(([kind, labels]) =>
    labels.map((label, index) => ({ kind, sortOrder: index, label })),
  );
}

export async function createRoleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parseRoleForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, location, commitment, briefSeed, owns, needs, bonus } = parsed.data;

  const existingSlugs = await prisma.careerRole.findMany({ select: { slug: true } });
  const slug = makeSlugUnique(slugify(title), new Set(existingSlugs.map((role) => role.slug)));

  const highestSortOrder = await prisma.careerRole.aggregate({ _max: { sortOrder: true } });

  await prisma.careerRole.create({
    data: {
      slug,
      sortOrder: (highestSortOrder._max.sortOrder ?? -1) + 1,
      title,
      location,
      commitment,
      briefSeed,
      bullets: { create: bulletRows({ owns, needs, bonus }) },
    },
  });

  revalidateCareers();
  redirect("/careers");
}

export async function updateRoleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return formError("Missing role id.");
  }

  const parsed = parseRoleForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, location, commitment, briefSeed, owns, needs, bonus } = parsed.data;

  const existing = await prisma.careerRole.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    return formError("That role no longer exists.");
  }

  await prisma.$transaction([
    prisma.careerRole.update({
      where: { id },
      data: { title, location, commitment, briefSeed },
    }),
    prisma.careerRoleBullet.deleteMany({ where: { roleId: id } }),
    prisma.careerRoleBullet.createMany({
      data: bulletRows({ owns, needs, bonus }).map((bullet) => ({ roleId: id, ...bullet })),
    }),
  ]);

  revalidateCareers(id);

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

export async function deleteRoleAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // Bullets go with it via `onDelete: Cascade`.
  await prisma.careerRole.delete({ where: { id } });

  // Close the gap so ordinals stay contiguous.
  const remaining = await prisma.careerRole.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((role, position) =>
      prisma.careerRole.update({ where: { id: role.id }, data: { sortOrder: position } }),
    ),
  );

  revalidateCareers();
  redirect("/careers");
}

export async function moveRoleAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "") as MoveDirection;

  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }

  const roles = await prisma.careerRole.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const updates = planReorder(
    roles.map((role) => role.id),
    id,
    direction,
  );

  if (!updates) {
    return;
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.careerRole.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } }),
    ),
  );

  revalidateCareers();
}

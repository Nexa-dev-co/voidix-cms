"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { planReorder, type MoveDirection } from "@/lib/content/reorder";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { makeSlugUnique, slugify } from "@/lib/text/slugify";
import { projectSchema } from "@/lib/validation/contentSchemas";

function revalidateWorks(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/works");
  if (id) {
    revalidatePath(`/admin/works/${id}`);
  }
}

function parseProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    title: formData.get("title") ?? "",
    client: formData.get("client") ?? "",
    year: formData.get("year") ?? "",
    description: formData.get("description") ?? "",
    tags: formData.get("tags") ?? "",
  });
}

export async function createProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, client, year, description, tags } = parsed.data;

  const existingSlugs = await prisma.project.findMany({ select: { slug: true } });
  const slug = makeSlugUnique(
    slugify(title),
    new Set(existingSlugs.map((project) => project.slug)),
  );

  const highestSortOrder = await prisma.project.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (highestSortOrder._max.sortOrder ?? -1) + 1;

  await prisma.project.create({
    data: {
      slug,
      sortOrder,
      title,
      client,
      year,
      description,
      tags: {
        create: tags.map((label, index) => ({ sortOrder: index, label })),
      },
    },
  });

  revalidateWorks();
  redirect("/admin/works");
}

export async function updateProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return formError("Missing project id.");
  }

  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, client, year, description, tags } = parsed.data;

  const existing = await prisma.project.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    return formError("That project no longer exists.");
  }

  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { title, client, year, description },
    }),
    prisma.projectTag.deleteMany({ where: { projectId: id } }),
    prisma.projectTag.createMany({
      data: tags.map((label, index) => ({ projectId: id, sortOrder: index, label })),
    }),
  ]);

  revalidateWorks(id);

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

export async function deleteProjectAction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // Tags go with it via `onDelete: Cascade` on the relation.
  await prisma.project.delete({ where: { id } });

  // Close the gap the delete left, so ordinals stay contiguous ("01, 02, 03" not "01, 03").
  const remaining = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((project, position) =>
      prisma.project.update({ where: { id: project.id }, data: { sortOrder: position } }),
    ),
  );

  revalidateWorks();
  redirect("/admin/works");
}

export async function moveProjectAction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "") as MoveDirection;

  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }

  const projects = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const updates = planReorder(
    projects.map((project) => project.id),
    id,
    direction,
  );

  if (!updates) {
    return;
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.project.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } }),
    ),
  );

  revalidateWorks();
}

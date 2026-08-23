"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import {
  markUrlPrefix,
  MARK_FILE_FIELD,
  MARK_MAX_BYTES,
  MARK_REMOVE_FIELD,
} from "@/lib/content/markStorage";
import { deleteStoredMark, resolveMarkChange } from "@/lib/content/markUploads";
import { planReorder, type MoveDirection } from "@/lib/content/reorder";
import {
  formError,
  formErrorFromZod,
  formFieldError,
  formSuccess,
  type FormState,
} from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { makeSlugUnique, slugify } from "@/lib/text/slugify";
import { projectSchema } from "@/lib/validation/contentSchemas";

const MARK_FIELDS = { fileField: MARK_FILE_FIELD, removeField: MARK_REMOVE_FIELD };

/**
 * How long the preview will wait for a stored mark.
 *
 * Short on purpose: an editor pressing Preview is standing there watching, and a mark that cannot
 * be had in this long is better reported as "showing the initial" than as a spinner.
 */
const MARK_READ_TIMEOUT_MS = 5_000;

function revalidateWorks(id?: string) {
  revalidatePath("/");
  revalidatePath("/works");
  if (id) {
    revalidatePath(`/works/${id}`);
  }
}

function parseProjectForm(formData: FormData) {
  return projectSchema.safeParse({
    title: formData.get("title") ?? "",
    client: formData.get("client") ?? "",
    year: formData.get("year") ?? "",
    description: formData.get("description") ?? "",
    tags: formData.get("tags") ?? "",
    disciplineId: formData.get("disciplineId") ?? "",
  });
}

export async function createProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, client, year, description, tags, disciplineId } = parsed.data;

  const existingSlugs = await prisma.project.findMany({ select: { slug: true } });
  const slug = makeSlugUnique(
    slugify(title),
    new Set(existingSlugs.map((project) => project.slug)),
  );

  // Stored before the row is written — see `resolveMarkChange`. A create that then fails would
  // leave one orphaned object in the bucket, which is a kilobyte; the reverse order leaves a
  // project claiming a mark that is not there, which is a broken body on the site.
  const markChange = await resolveMarkChange(formData, { projectSlug: slug, ...MARK_FIELDS });

  if (markChange.kind === "refused") {
    return formFieldError(MARK_FILE_FIELD, markChange.message);
  }

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
      disciplineId,
      // A brand new project has nothing to clear, so "unchanged" and "cleared" both mean no mark.
      markSvgUrl: markChange.kind === "stored" ? markChange.url : null,
      markStoragePath: markChange.kind === "stored" ? markChange.storagePath : null,
      tags: {
        create: tags.map((label, index) => ({ sortOrder: index, label })),
      },
    },
  });

  revalidateWorks();
  redirect("/works");
}

export async function updateProjectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return formError("Missing project id.");
  }

  const parsed = parseProjectForm(formData);

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { title, client, year, description, tags, disciplineId } = parsed.data;

  const existing = await prisma.project.findUnique({
    where: { id },
    // The old object's path, so replacing or clearing the mark can take the file with it rather
    // than leaving something in the bucket nothing knows the name of.
    select: { id: true, slug: true, markStoragePath: true },
  });

  if (!existing) {
    return formError("That project no longer exists.");
  }

  const markChange = await resolveMarkChange(formData, {
    projectSlug: existing.slug,
    ...MARK_FIELDS,
  });

  if (markChange.kind === "refused") {
    return formFieldError(MARK_FILE_FIELD, markChange.message);
  }

  // `unchanged` writes neither column, so an ordinary copy edit cannot disturb the mark.
  const markData =
    markChange.kind === "stored"
      ? { markSvgUrl: markChange.url, markStoragePath: markChange.storagePath }
      : markChange.kind === "cleared"
        ? { markSvgUrl: null, markStoragePath: null }
        : {};

  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { title, client, year, description, disciplineId, ...markData },
    }),
    prisma.projectTag.deleteMany({ where: { projectId: id } }),
    prisma.projectTag.createMany({
      data: tags.map((label, index) => ({ projectId: id, sortOrder: index, label })),
    }),
  ]);

  // ⚠ AFTER the write, and only once it succeeded. Deleting first and then failing to write would
  // destroy the file the row still points at.
  if (markChange.kind !== "unchanged") {
    await deleteStoredMark(existing.markStoragePath);
  }

  revalidateWorks(id);

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

export async function deleteProjectAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  // Read before the row goes: afterwards there is nothing left that knows where the file is.
  const removed = await prisma.project.findUnique({
    where: { id },
    select: { markStoragePath: true },
  });

  // Tags go with it via `onDelete: Cascade` on the relation. The mark does not — storage has no
  // foreign keys — so it is deleted by hand, after the row, for the ordering reason in `update`.
  await prisma.project.delete({ where: { id } });
  await deleteStoredMark(removed?.markStoragePath);

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
  redirect("/works");
}

export async function moveProjectAction(formData: FormData) {
  await requireAdmin();

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

/**
 * The SVG text of a project's stored mark, for the preview to cut.
 *
 * ── ⚠ WHY THE BYTES COME BACK THROUGH THE SERVER ────────────────────────────────────────────────
 * The panel could fetch the storage URL from the browser — it is a public bucket and the edit page
 * already puts that URL in an `<img>`. This does not, for the same reason the site's
 * `lib/cms/markSource.ts` does not: the fetch is then a cross-origin request whose success depends
 * on Supabase's CORS headers staying as they are, and a preview that works until someone tightens a
 * bucket setting is a preview nobody will trust. Server-side there is no CORS question to have.
 *
 * ⚠ The URL is re-derived from the row, and checked against `markUrlPrefix()` before anything is
 * fetched. Nothing here trusts an id to name a location: `resolveMarkChange` is the only writer of
 * that column and it only ever writes a URL it built itself, but "the writer validates it" is not a
 * property this side can check. It FAILS CLOSED — an unrecognised prefix returns null and the
 * preview shows the initial, which is a state an editor can see and explain.
 *
 * Returns null rather than throwing for every miss: no project, no mark, an unreachable object. The
 * caller has one honest thing to show in all of those cases, and it is the initial.
 */
export async function readProjectMarkSource(projectId: string): Promise<string | null> {
  await requireAdmin();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { markSvgUrl: true },
  });

  if (!project?.markSvgUrl) {
    return null;
  }

  if (!project.markSvgUrl.startsWith(markUrlPrefix())) {
    console.warn("[marks] refusing to read a mark URL outside the configured storage prefix.");
    return null;
  }

  try {
    const response = await fetch(project.markSvgUrl, {
      signal: AbortSignal.timeout(MARK_READ_TIMEOUT_MS),
      // The bucket is public and the object is immutable — a new upload is a new path, never an
      // overwrite — so anything cached is by construction still correct.
      cache: "force-cache",
    });

    if (!response.ok) {
      return null;
    }

    const source = await response.text();

    // The cap is enforced on the way in as well; re-checked here because the object could predate a
    // lowered limit, and because the preview parses every byte of it on the editor's main thread.
    return new Blob([source]).size > MARK_MAX_BYTES ? null : source;
  } catch {
    return null;
  }
}

"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { publishRelease } from "@/lib/content/publish";
import { isPublishSection } from "@/lib/content/publishSelection";
import { formError, formSuccess, type FormState } from "@/lib/forms/formState";
import { releaseNoteSchema } from "@/lib/validation/contentSchemas";

export async function publishAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireAdmin();

  const parsedNote = releaseNoteSchema.safeParse(String(formData.get("note") ?? ""));

  if (!parsedNote.success) {
    return formError(parsedNote.error.issues[0]?.message ?? "That note is too long.");
  }

  const rawSections = formData.getAll("sections").map(String);
  const invalidSection = rawSections.find((section) => !isPublishSection(section));

  if (invalidSection) {
    return formError("That publishing selection is not valid. Refresh the page and try again.");
  }

  const sections = rawSections.filter(isPublishSection);
  const blogSlugs = formData
    .getAll("blogSlugs")
    .map(String)
    .filter((slug) => slug.length > 0);
  const publishAll = formData.get("publishAll") === "true";

  if (!publishAll && sections.length === 0 && blogSlugs.length === 0) {
    return formError("Choose at least one section or blog article to publish.");
  }

  let result;

  try {
    result = await publishRelease({
      publishedBy: user.email ?? null,
      note: parsedNote.data.length > 0 ? parsedNote.data : null,
      selection: { sections, blogSlugs },
      publishAll,
    });
  } catch (error) {
    return formError(error instanceof Error ? error.message : "The release could not be published.");
  }

  revalidatePath("/");
  revalidatePath("/releases");

  if (result.revalidateStatus === "failed") {
    return formError(
      `Release v${result.version} was saved, but the site couldn't be reached: ${result.revalidateDetail}`,
    );
  }

  if (result.revalidateStatus === "skipped") {
    return formSuccess(
      `Published release v${result.version}. The site isn't wired to this CMS yet, so nothing was rebuilt — the content is stored and ready.`,
    );
  }

  return formSuccess(`Published release v${result.version} and rebuilt the site.`);
}

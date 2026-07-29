"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { publishRelease } from "@/lib/content/publish";
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

  const result = await publishRelease({
    publishedBy: user.email ?? null,
    note: parsedNote.data.length > 0 ? parsedNote.data : null,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/releases");

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

"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { disciplineSchema, enquiryFormSchema } from "@/lib/validation/contentSchemas";

/**
 * Saves the shared form strings and all four discipline prefills in one go.
 *
 * One action because it is one editing job — the labels a visitor reads and the subject their
 * enquiry arrives under are the same screen's worth of decisions, and two Save buttons on one
 * page is a way to lose half your work.
 *
 * The disciplines are fixed rows: an editor changes what each one says, never which ones exist.
 * `key` is what the site binds services and projects to, so it is not editable and not accepted
 * here — the ids are read back from the database rather than trusted from the form.
 */
export async function updateEnquiryFormAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsedForm = enquiryFormSchema.safeParse({
    nameLabel: formData.get("nameLabel") ?? "",
    emailLabel: formData.get("emailLabel") ?? "",
    phoneLabel: formData.get("phoneLabel") ?? "",
    sendingLabel: formData.get("sendingLabel") ?? "",
    sentMessage: formData.get("sentMessage") ?? "",
    errorMessage: formData.get("errorMessage") ?? "",
    referenceSubjectSuffix: formData.get("referenceSubjectSuffix") ?? "",
    referenceBriefPrefix: formData.get("referenceBriefPrefix") ?? "",
  });

  if (!parsedForm.success) {
    return formErrorFromZod(parsedForm.error);
  }

  const disciplines = await prisma.discipline.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true },
  });

  const disciplineUpdates: { id: string; label: string; briefSeed: string }[] = [];

  for (const discipline of disciplines) {
    const parsed = disciplineSchema.safeParse({
      label: formData.get(`label:${discipline.key}`) ?? "",
      briefSeed: formData.get(`briefSeed:${discipline.key}`) ?? "",
    });

    if (!parsed.success) {
      // Re-key the field errors onto the inputs they came from, so the message lands under the
      // right discipline rather than on a "label" field that appears four times.
      const issues = parsed.error.issues.map((issue) => ({
        ...issue,
        path: [`${String(issue.path[0])}:${discipline.key}`],
      }));

      return formErrorFromZod({ ...parsed.error, issues } as typeof parsed.error);
    }

    disciplineUpdates.push({ id: discipline.id, ...parsed.data });
  }

  await prisma.$transaction([
    prisma.enquiryFormContent.upsert({
      where: { id: SINGLETON_ROW_ID },
      create: { id: SINGLETON_ROW_ID, ...parsedForm.data },
      update: parsedForm.data,
    }),
    ...disciplineUpdates.map((update) =>
      prisma.discipline.update({
        where: { id: update.id },
        data: { label: update.label, briefSeed: update.briefSeed },
      }),
    ),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/enquiry-form");

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

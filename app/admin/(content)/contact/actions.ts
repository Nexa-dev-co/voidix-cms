"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validation/contentSchemas";

export async function updateContactAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = contactSchema.safeParse({
    eyebrow: formData.get("eyebrow") ?? "",
    titleLine1: formData.get("titleLine1") ?? "",
    titleLine2: formData.get("titleLine2") ?? "",
    description: formData.get("description") ?? "",
    emailAddress: formData.get("emailAddress") ?? "",
    formNameLabel: formData.get("formNameLabel") ?? "",
    formEmailLabel: formData.get("formEmailLabel") ?? "",
    formMessageLabel: formData.get("formMessageLabel") ?? "",
    submitLabel: formData.get("submitLabel") ?? "",
    successMessage: formData.get("successMessage") ?? "",
    errorMessage: formData.get("errorMessage") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  // Upsert on the fixed key rather than update — the row may not exist yet, and this way
  // there is no path that could ever create a second one.
  await prisma.contactSection.upsert({
    where: { id: SINGLETON_ROW_ID },
    create: { id: SINGLETON_ROW_ID, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/contact");

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

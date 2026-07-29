"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { footerSchema } from "@/lib/validation/contentSchemas";

export async function updateFooterAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = footerSchema.safeParse({
    tagline: formData.get("tagline") ?? "",
    copyright: formData.get("copyright") ?? "",
    socialLinks: formData.get("socialLinks") ?? "",
    legalLinks: formData.get("legalLinks") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { tagline, copyright, socialLinks, legalLinks } = parsed.data;

  await prisma.$transaction([
    prisma.footerContent.upsert({
      where: { id: SINGLETON_ROW_ID },
      create: { id: SINGLETON_ROW_ID, tagline, copyright },
      update: { tagline, copyright },
    }),
    // Links carry no identity worth preserving, so the set is replaced rather than diffed —
    // same reasoning as the capability and tag chips.
    prisma.footerSocialLink.deleteMany({}),
    prisma.footerSocialLink.createMany({
      data: socialLinks.map((link, index) => ({
        sortOrder: index,
        label: link.label,
        url: link.url,
      })),
    }),
    prisma.footerLegalLink.deleteMany({}),
    prisma.footerLegalLink.createMany({
      data: legalLinks.map((link, index) => ({
        sortOrder: index,
        label: link.label,
        url: link.url,
      })),
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/footer");

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

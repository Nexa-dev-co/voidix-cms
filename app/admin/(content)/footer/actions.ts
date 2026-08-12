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
    signOff: formData.get("signOff") ?? "",
    linkGroups: formData.get("linkGroups") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { tagline, signOff, linkGroups } = parsed.data;

  await prisma.$transaction([
    prisma.footerContent.upsert({
      where: { id: SINGLETON_ROW_ID },
      create: { id: SINGLETON_ROW_ID, tagline, signOff },
      update: { tagline, signOff },
    }),
    // Groups and their links carry no identity worth preserving, so the whole set is replaced
    // rather than diffed — same reasoning as the capability and tag chips. The links go with
    // their group via `onDelete: Cascade`, which is why only the groups are deleted here.
    prisma.footerLinkGroup.deleteMany({}),
    ...linkGroups.map((group, groupIndex) =>
      prisma.footerLinkGroup.create({
        data: {
          sortOrder: groupIndex,
          title: group.title,
          links: {
            create: group.links.map((link, linkIndex) => ({
              sortOrder: linkIndex,
              label: link.label,
              href: link.href,
            })),
          },
        },
      }),
    ),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/footer");

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

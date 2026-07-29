"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validation/contentSchemas";

/**
 * Updates one service's copy.
 *
 * There is deliberately no create, delete or reorder action in this file. A service is bound
 * to a .glb vessel and to a placement entry in the site's deckTuning.ts that is keyed by
 * ARRAY POSITION, and `hiddenParts` entries encode that position in strings like "2:14".
 * Adding a service without a model gives the deck nothing to render; reordering or deleting
 * one silently rebinds every ship's placement to the wrong vessel — nothing throws, the
 * fleet just sits wrong. Making this list mutable is a site-side refactor first: move the
 * placement onto the service record and key `hiddenParts` by slug instead of index.
 */
export async function updateServiceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return formError("Missing service id.");
  }

  const parsed = serviceSchema.safeParse({
    name: formData.get("name") ?? "",
    eyebrow: formData.get("eyebrow") ?? "",
    description: formData.get("description") ?? "",
    capabilities: formData.get("capabilities") ?? "",
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { name, eyebrow, description, capabilities } = parsed.data;

  const existing = await prisma.service.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    return formError("That service no longer exists.");
  }

  await prisma.$transaction([
    prisma.service.update({
      where: { id },
      data: { name, eyebrow, description },
    }),
    // Chips carry no identity of their own, so replacing the set is simpler than diffing it
    // and guarantees the stored order matches what was typed.
    prisma.serviceCapability.deleteMany({ where: { serviceId: id } }),
    prisma.serviceCapability.createMany({
      data: capabilities.map((label, index) => ({ serviceId: id, sortOrder: index, label })),
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/services");
  revalidatePath(`/admin/services/${id}`);

  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

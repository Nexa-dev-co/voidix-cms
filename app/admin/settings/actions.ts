"use server";

import { revalidatePath } from "next/cache";

import { AutoAssignMode } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { formError, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { toPlainLine } from "@/lib/text/plainText";

const MATCH_ACTIONS = new Set(["enrich", "log", "overwrite", "skip"]);
const MIN_IMPORT_ROWS = 1;
const MAX_IMPORT_ROWS = 20000;

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function saveLeadSettingsAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const rawMode = String(formData.get("autoAssignMode") ?? "");
  const autoAssignMode =
    rawMode === AutoAssignMode.ROUND_ROBIN || rawMode === AutoAssignMode.FIXED
      ? rawMode
      : AutoAssignMode.UNASSIGNED;

  const rawFixedMember = String(formData.get("autoAssignMemberId") ?? "");
  const autoAssignMemberId = rawFixedMember.length > 0 ? rawFixedMember : null;

  if (autoAssignMode === AutoAssignMode.FIXED && !autoAssignMemberId) {
    return formError("Pick who new website leads should go to.");
  }

  const importMaxRows = Number(formData.get("importMaxRows") ?? MAX_IMPORT_ROWS);

  if (
    !Number.isInteger(importMaxRows) ||
    importMaxRows < MIN_IMPORT_ROWS ||
    importMaxRows > MAX_IMPORT_ROWS
  ) {
    return formError(`Max rows per import must be between ${MIN_IMPORT_ROWS} and ${MAX_IMPORT_ROWS}.`);
  }

  const rawMatchAction = String(formData.get("importDefaultMatchAction") ?? "enrich");
  const importDefaultMatchAction = MATCH_ACTIONS.has(rawMatchAction) ? rawMatchAction : "enrich";

  const values = {
    autoAssignMode,
    autoAssignMemberId: autoAssignMode === AutoAssignMode.FIXED ? autoAssignMemberId : null,
    salesCanEditContact: readCheckbox(formData, "salesCanEditContact"),
    salesCanClaimUnassigned: readCheckbox(formData, "salesCanClaimUnassigned"),
    salesCanExport: readCheckbox(formData, "salesCanExport"),
    salesCanSeeOthersAttempts: readCheckbox(formData, "salesCanSeeOthersAttempts"),
    importDefaultMatchAction,
    importMaxRows,
    importAllowOverwrite: readCheckbox(formData, "importAllowOverwrite"),
  };

  await prisma.leadSettings.upsert({
    where: { id: SINGLETON_ROW_ID },
    create: { id: SINGLETON_ROW_ID, ...values },
    update: values,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads");

  return formSuccess("Settings saved.");
}

type VocabularyKind = "channel" | "outcome";

function parseVocabularyKind(value: FormDataEntryValue | null): VocabularyKind | null {
  const kind = String(value ?? "");

  return kind === "channel" || kind === "outcome" ? kind : null;
}

export async function addVocabularyAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const kind = parseVocabularyKind(formData.get("kind"));
  const label = toPlainLine(String(formData.get("label") ?? ""));

  if (!kind) {
    return formError("Unknown list.");
  }

  if (label.length === 0) {
    return formError("Type a label first.");
  }

  const maxLength = kind === "channel" ? 40 : 60;

  if (label.length > maxLength) {
    return formError(`Keep it to ${maxLength} characters or fewer.`);
  }

  try {
    if (kind === "channel") {
      const highest = await prisma.attemptChannel.aggregate({ _max: { sortOrder: true } });
      await prisma.attemptChannel.create({
        data: { label, sortOrder: (highest._max.sortOrder ?? -1) + 1 },
      });
    } else {
      const highest = await prisma.attemptOutcome.aggregate({ _max: { sortOrder: true } });
      await prisma.attemptOutcome.create({
        data: { label, sortOrder: (highest._max.sortOrder ?? -1) + 1 },
      });
    }
  } catch {
    // The unique index on `label` is what we're catching here.
    return formError(`"${label}" is already in that list.`);
  }

  revalidatePath("/admin/settings");

  return formSuccess(`Added "${label}".`);
}

/**
 * Retires a channel or outcome without deleting it.
 *
 * Attempts store the label as text, so past history reads correctly either way — but keeping
 * the row means the same word can be reactivated later rather than re-created and re-ordered.
 */
export async function toggleVocabularyAction(formData: FormData) {
  await requireAdmin();

  const kind = parseVocabularyKind(formData.get("kind"));
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!kind || !id) {
    return;
  }

  if (kind === "channel") {
    await prisma.attemptChannel.update({ where: { id }, data: { isActive } });
  } else {
    await prisma.attemptOutcome.update({ where: { id }, data: { isActive } });
  }

  revalidatePath("/admin/settings");
}

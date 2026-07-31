"use server";

import { revalidatePath } from "next/cache";

import { AutoAssignMode, CustomFieldKind, StageKind } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { planReorder } from "@/lib/content/reorder";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import {
  formError,
  formErrorFromZod,
  formSuccess,
  type FormState,
} from "@/lib/forms/formState";
import { CUSTOM_FIELD_LIMITS, kindNeedsOptions } from "@/lib/leads/customFieldTypes";
import {
  clampWidth,
  parseColumnKey,
  parseColumnLayout,
  serialiseColumnLayout,
  type ColumnLayoutEntry,
} from "@/lib/leads/tableColumns";
import { prisma } from "@/lib/prisma";
import { toPlainLine } from "@/lib/text/plainText";
import { makeSlugUnique, slugify } from "@/lib/text/slugify";
import { pipelineStageSchema } from "@/lib/validation/contactSchemas";

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
    salesCanCloseLeads: readCheckbox(formData, "salesCanCloseLeads"),
    salesCanEditCustomFields: readCheckbox(formData, "salesCanEditCustomFields"),
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

function revalidateLeadsViews() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

export async function addPipelineStageAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = pipelineStageSchema.safeParse({
    label: formData.get("label") ?? "",
    kind: String(formData.get("kind") ?? "OPEN"),
  });

  if (!parsed.success) {
    return formErrorFromZod(parsed.error);
  }

  const { label, kind } = parsed.data;

  try {
    const highest = await prisma.pipelineStage.aggregate({ _max: { sortOrder: true } });
    await prisma.pipelineStage.create({
      data: { label, kind, sortOrder: (highest._max.sortOrder ?? -1) + 1 },
    });
  } catch {
    // The unique index on `label` is what we're catching here.
    return formError(`"${label}" is already a stage.`);
  }

  revalidateLeadsViews();

  return formSuccess(`Added "${label}".`);
}

/**
 * Retires a stage, or brings it back.
 *
 * Never deletes. Contacts point at the row, `contact_stage_changes` snapshots its label as text,
 * and the foreign key is `Restrict` — so a stage with leads in it cannot be removed even by
 * accident. Retiring takes it off the stage picker while everything already there keeps working.
 */
export async function togglePipelineStageAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id) {
    return;
  }

  // Retiring the last open stage would leave new leads nowhere to land, so it is refused. Won and
  // Lost are ends, not places a lead can arrive.
  if (!isActive) {
    const remainingOpen = await prisma.pipelineStage.count({
      where: { isActive: true, kind: StageKind.OPEN, id: { not: id } },
    });

    if (remainingOpen === 0) {
      return;
    }
  }

  await prisma.pipelineStage.update({ where: { id }, data: { isActive } });

  revalidateLeadsViews();
}

export async function reorderPipelineStageAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const updates = planReorder(
    stages.map((stage) => stage.id),
    id,
    direction,
  );

  if (!updates) {
    return;
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.pipelineStage.update({
        where: { id: update.id },
        data: { sortOrder: update.sortOrder },
      }),
    ),
  );

  revalidateLeadsViews();
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

function parseFieldKind(value: FormDataEntryValue | null): CustomFieldKind | null {
  const candidate = String(value ?? "");

  return (Object.values(CustomFieldKind) as string[]).includes(candidate)
    ? (candidate as CustomFieldKind)
    : null;
}

/**
 * Splits the options textarea into a clean list.
 *
 * Comma or newline separated, the same shape as the chip inputs on the content forms, so an
 * admin who has used those already knows how this behaves.
 */
function parseOptions(raw: string): string[] {
  const seen = new Set<string>();

  return raw
    .split(/[\n,]/)
    .map((option) => toPlainLine(option))
    .filter((option) => {
      if (option.length === 0 || option.length > CUSTOM_FIELD_LIMITS.option || seen.has(option)) {
        return false;
      }
      seen.add(option);
      return true;
    })
    .slice(0, CUSTOM_FIELD_LIMITS.optionCount);
}

export async function addCustomFieldAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const label = toPlainLine(String(formData.get("label") ?? ""));
  const kind = parseFieldKind(formData.get("kind"));
  const helpText = toPlainLine(String(formData.get("helpText") ?? ""));
  const options = parseOptions(String(formData.get("options") ?? ""));

  if (label.length === 0) {
    return formError("Give the field a name.");
  }

  if (label.length > CUSTOM_FIELD_LIMITS.label) {
    return formError(`Keep the name to ${CUSTOM_FIELD_LIMITS.label} characters or fewer.`);
  }

  if (!kind) {
    return formError("Pick what kind of field it is.");
  }

  if (kindNeedsOptions(kind) && options.length === 0) {
    return formError("A dropdown needs at least one option.");
  }

  if (helpText.length > CUSTOM_FIELD_LIMITS.helpText) {
    return formError(`Keep the hint to ${CUSTOM_FIELD_LIMITS.helpText} characters or fewer.`);
  }

  const existingKeys = await prisma.contactFieldDefinition.findMany({ select: { key: true } });
  const key = makeSlugUnique(
    slugify(label),
    new Set(existingKeys.map((definition) => definition.key)),
  );

  const highest = await prisma.contactFieldDefinition.aggregate({ _max: { sortOrder: true } });

  await prisma.contactFieldDefinition.create({
    data: {
      key,
      label,
      kind,
      options: kindNeedsOptions(kind) ? options : [],
      helpText: helpText.length > 0 ? helpText : null,
      sortOrder: (highest._max.sortOrder ?? -1) + 1,
    },
  });

  revalidateLeadsViews();

  return formSuccess(`Added "${label}". It's already a column on the leads table.`);
}

/**
 * Renames a field, changes its hint, or edits a dropdown's options.
 *
 * The `kind` is deliberately fixed after creation. Changing a text field to a number would leave
 * every stored value in the wrong column with nothing sensible to migrate them to, and the honest
 * version of that is a new field rather than a silent conversion.
 */
export async function updateCustomFieldAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const label = toPlainLine(String(formData.get("label") ?? ""));
  const helpText = toPlainLine(String(formData.get("helpText") ?? ""));

  if (!id) {
    return formError("Unknown field.");
  }

  if (label.length === 0 || label.length > CUSTOM_FIELD_LIMITS.label) {
    return formError(`The name must be 1 to ${CUSTOM_FIELD_LIMITS.label} characters.`);
  }

  const definition = await prisma.contactFieldDefinition.findUnique({
    where: { id },
    select: { kind: true, options: true },
  });

  if (!definition) {
    return formError("That field no longer exists.");
  }

  let options = definition.options;

  if (kindNeedsOptions(definition.kind)) {
    options = parseOptions(String(formData.get("options") ?? ""));

    if (options.length === 0) {
      return formError("A dropdown needs at least one option.");
    }
  }

  await prisma.contactFieldDefinition.update({
    where: { id },
    data: { label, helpText: helpText.length > 0 ? helpText : null, options },
  });

  revalidateLeadsViews();

  return formSuccess("Saved.");
}

/**
 * Retires a custom field, or restores it.
 *
 * There is no delete. Values stay in `contact_field_values` while the definition is retired, so
 * bringing it back brings the data with it — and no admin can wipe hundreds of people's records
 * with a mis-click. It is the same bargain every other vocabulary in this system makes.
 */
export async function toggleCustomFieldAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id) {
    return;
  }

  await prisma.contactFieldDefinition.update({ where: { id }, data: { isActive } });

  revalidateLeadsViews();
}

export async function reorderCustomFieldAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!id || (direction !== "up" && direction !== "down")) {
    return;
  }

  const definitions = await prisma.contactFieldDefinition.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  const updates = planReorder(
    definitions.map((definition) => definition.id),
    id,
    direction,
  );

  if (!updates) {
    return;
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.contactFieldDefinition.update({
        where: { id: update.id },
        data: { sortOrder: update.sortOrder },
      }),
    ),
  );

  revalidateLeadsViews();
}

// ---------------------------------------------------------------------------
// Leads table column layout
// ---------------------------------------------------------------------------

/**
 * Saves which columns the leads table shows, in what order and at what width.
 *
 * The order arrives as a single ordered list of keys rather than a sortOrder per row, because the
 * layout editor moves entries around client-side before submitting — reconstructing it from
 * per-row indices would need every row to agree, and they can't while one is mid-move.
 */
export async function saveColumnLayoutAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const orderedKeys = formData
    .getAll("columnKey")
    .map((value) => String(value))
    .filter((key) => parseColumnKey(key) !== null);

  const visibleKeys = new Set(formData.getAll("visible").map((value) => String(value)));

  const layout: ColumnLayoutEntry[] = orderedKeys.map((key) => ({
    key,
    visible: visibleKeys.has(key),
    width: clampWidth(Number(formData.get(`width_${key}`) ?? 0)),
  }));

  await prisma.leadSettings.upsert({
    where: { id: SINGLETON_ROW_ID },
    create: { id: SINGLETON_ROW_ID, leadsTableColumns: serialiseColumnLayout(layout) },
    update: { leadsTableColumns: serialiseColumnLayout(layout) },
  });

  revalidateLeadsViews();

  return formSuccess("Columns saved.");
}

/**
 * Persists a width dragged in the table header.
 *
 * Merges into the stored layout rather than replacing it, because this arrives from the table
 * rather than the layout editor and knows nothing about visibility or order.
 */
export async function saveColumnWidthAction(formData: FormData) {
  await requireAdmin();

  const key = String(formData.get("key") ?? "");
  const width = clampWidth(Number(formData.get("width") ?? 0));

  if (parseColumnKey(key) === null) {
    return;
  }

  const settings = await prisma.leadSettings.findUnique({
    where: { id: SINGLETON_ROW_ID },
    select: { leadsTableColumns: true },
  });

  const layout = parseColumnLayout(settings?.leadsTableColumns);
  const existing = layout.find((entry) => entry.key === key);

  const merged = existing
    ? layout.map((entry) => (entry.key === key ? { ...entry, width } : entry))
    : [...layout, { key, visible: true, width }];

  await prisma.leadSettings.upsert({
    where: { id: SINGLETON_ROW_ID },
    create: { id: SINGLETON_ROW_ID, leadsTableColumns: serialiseColumnLayout(merged) },
    update: { leadsTableColumns: serialiseColumnLayout(merged) },
  });

  revalidatePath("/admin/leads");
}

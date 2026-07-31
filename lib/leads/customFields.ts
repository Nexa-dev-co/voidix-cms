import {
  CUSTOM_FIELD_INPUT_PREFIX,
  parseFieldValue,
  toCustomFieldCell,
  type CustomFieldCell,
  type CustomFieldDefinitionSummary,
} from "@/lib/leads/customFieldTypes";
import { prisma } from "@/lib/prisma";

/**
 * Database access for admin-defined contact fields.
 *
 * The shapes, limits and coercion rules live in `customFieldTypes.ts` so Client Components can
 * share them — this module is the half that talks to Postgres and must stay on the server.
 */

const DEFINITION_SELECT = {
  id: true,
  key: true,
  label: true,
  kind: true,
  options: true,
  helpText: true,
  sortOrder: true,
  isActive: true,
} as const;

/** The fields currently in use — what the table, the forms and the importer offer. */
export async function getActiveFieldDefinitions(): Promise<CustomFieldDefinitionSummary[]> {
  return prisma.contactFieldDefinition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: DEFINITION_SELECT,
  });
}

/** Every field, retired ones included. Settings needs these to offer "Restore". */
export async function getAllFieldDefinitions(): Promise<CustomFieldDefinitionSummary[]> {
  return prisma.contactFieldDefinition.findMany({
    orderBy: { sortOrder: "asc" },
    select: DEFINITION_SELECT,
  });
}

/**
 * Writes every submitted custom field for one contact.
 *
 * An emptied field deletes its row rather than storing a row full of nulls, so "has a value" is
 * answerable by the row's existence — which is what keeps the leads table's nulls-last ordering
 * correct when it sorts by a custom column.
 */
export async function writeCustomFieldValues(
  contactId: string,
  definitions: CustomFieldDefinitionSummary[],
  readRawValues: (definition: CustomFieldDefinitionSummary) => string[],
): Promise<{ ok: true } | { ok: false; fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {};
  const writes: { definitionId: string; parsed: ReturnType<typeof parseFieldValue> }[] = [];

  for (const definition of definitions) {
    const parsed = parseFieldValue(definition, readRawValues(definition));

    if (!parsed.ok) {
      fieldErrors[`${CUSTOM_FIELD_INPUT_PREFIX}${definition.id}`] = parsed.error;
      continue;
    }

    writes.push({ definitionId: definition.id, parsed });
  }

  // Nothing is written if anything failed — a half-saved form is worse than a rejected one.
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  await prisma.$transaction(
    writes.map(({ definitionId, parsed }) => {
      if (!parsed.ok || parsed.isEmpty) {
        return prisma.contactFieldValue.deleteMany({ where: { contactId, definitionId } });
      }

      return prisma.contactFieldValue.upsert({
        where: { contactId_definitionId: { contactId, definitionId } },
        create: { contactId, definitionId, ...parsed.data },
        update: parsed.data,
      });
    }),
  );

  return { ok: true };
}

/** Loads one contact's values, in definition order. */
export async function getCustomFieldCells(
  contactId: string,
  definitions: CustomFieldDefinitionSummary[],
): Promise<CustomFieldCell[]> {
  if (definitions.length === 0) {
    return [];
  }

  const stored = await prisma.contactFieldValue.findMany({
    where: { contactId, definitionId: { in: definitions.map((definition) => definition.id) } },
  });

  const storedByDefinition = new Map(stored.map((row) => [row.definitionId, row]));

  return definitions.map((definition) =>
    toCustomFieldCell(definition, storedByDefinition.get(definition.id)),
  );
}

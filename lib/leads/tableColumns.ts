import { CustomFieldKind } from "@/generated/prisma/enums";
import { isSortableKind, type CustomFieldDefinitionSummary } from "@/lib/leads/customFieldTypes";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The leads table's column layout.
 *
 * The whole layout lives in one place — `lead_settings.leads_table_columns` — rather than being
 * split between this list and a "show in table" flag on each custom field definition. Two homes
 * for one decision means two ways to disagree about whether a column is visible, and nothing to
 * arbitrate between them.
 *
 * A key is `builtin:<id>` or `custom:<definitionId>`, so the two kinds of column sort, hide and
 * reorder through exactly the same code.
 */

export const BUILTIN_COLUMN_PREFIX = "builtin:";
export const CUSTOM_COLUMN_PREFIX = "custom:";

const DEFAULT_COLUMN_WIDTH = 180;
export const MIN_COLUMN_WIDTH = 80;
export const MAX_COLUMN_WIDTH = 640;

/** A column the CMS ships with, backed by a real column on `contacts`. */
export interface BuiltinColumn {
  id: string;
  label: string;
  /** The `orderBy` this maps onto. Absent means the column can be shown but not sorted. */
  sortKey:
    | "name"
    | "email"
    | "company"
    | "phone"
    | "stage"
    | "source"
    | "addedBy"
    | "owner"
    | "nextFollowUpAt"
    | "createdAt"
    | null;
  defaultWidth: number;
  /** Kept out of the layout editor — the name column is how you open a lead. */
  isLocked?: boolean;
}

/**
 * Widths are minimums in practice, not fixed sizes.
 *
 * They were originally squeezed to fit the ~770px reading column the whole panel used to sit in;
 * the leads page now fills the shell, and `table-fixed` shares any leftover width across the
 * columns proportionally. So these decide the *ratio* between columns and the point at which the
 * table starts scrolling sideways, not how wide a column ends up on a large screen. Values still
 * truncate with the full text on hover — a table you can read across is worth more than one where
 * every cell fits.
 *
 * The eight in `DEFAULT_VISIBLE_BUILTINS` come to 974px with the checkbox column. A 1366-wide
 * laptop has 1,046px once the sidebar and page padding are gone, and the table's own vertical
 * scrollbar takes ~15 of those the moment the rows overflow — so the target to beat is nearer
 * 1,030 than 1,046, and the slack is deliberate rather than the result being three pixels over.
 * Showing more columns than this is fine, the table scrolls sideways with Name pinned; the
 * *default* set is what should fit the smallest screen in use without anyone touching Settings.
 */
export const BUILTIN_COLUMNS: BuiltinColumn[] = [
  { id: "name", label: "Name", sortKey: "name", defaultWidth: 160, isLocked: true },
  { id: "email", label: "Email", sortKey: "email", defaultWidth: 155 },
  { id: "company", label: "Company", sortKey: "company", defaultWidth: 115 },
  { id: "phone", label: "Phone", sortKey: "phone", defaultWidth: 115 },
  { id: "stage", label: "Stage", sortKey: "stage", defaultWidth: 95 },
  { id: "source", label: "Source", sortKey: "source", defaultWidth: 100 },
  // Who put the lead in, which is a different question from who works it now — an importer
  // rarely keeps what they upload.
  { id: "addedBy", label: "Added by", sortKey: "addedBy", defaultWidth: 100 },
  { id: "owner", label: "Owner", sortKey: "owner", defaultWidth: 105 },
  { id: "nextFollowUp", label: "Next follow-up", sortKey: "nextFollowUpAt", defaultWidth: 100 },
  { id: "lastAttempt", label: "Last attempt", sortKey: null, defaultWidth: 140 },
  { id: "touchpoints", label: "Touchpoints", sortKey: null, defaultWidth: 95 },
  { id: "createdAt", label: "Added", sortKey: "createdAt", defaultWidth: 95 },
];

/**
 * What a fresh install shows before anybody opens Settings.
 *
 * "Added" is off by default: a lead's arrival date is rarely what you scan a pipeline for, and it
 * is the column most likely to push the table past the fold. Source and Added by are on, because
 * knowing a row came off a spreadsheet rather than out of the website changes how you read every
 * other column in it — and an admin who disagrees can switch either off in one place.
 */
const DEFAULT_VISIBLE_BUILTINS = [
  "name",
  "email",
  "company",
  "stage",
  "source",
  "addedBy",
  "owner",
  "nextFollowUp",
];

export interface ColumnLayoutEntry {
  key: string;
  visible: boolean;
  width: number;
}

/** A column resolved against the current field definitions, ready to render. */
export interface ResolvedColumn {
  key: string;
  label: string;
  width: number;
  visible: boolean;
  /** The `sort` URL parameter this column accepts, or null when it can't be sorted. */
  sortKey: string | null;
  builtin: BuiltinColumn | null;
  definition: CustomFieldDefinitionSummary | null;
  isLocked: boolean;
}

export function builtinColumnKey(id: string): string {
  return `${BUILTIN_COLUMN_PREFIX}${id}`;
}

export function customColumnKey(definitionId: string): string {
  return `${CUSTOM_COLUMN_PREFIX}${definitionId}`;
}

export function parseColumnKey(
  key: string,
): { kind: "builtin"; id: string } | { kind: "custom"; definitionId: string } | null {
  if (key.startsWith(BUILTIN_COLUMN_PREFIX)) {
    return { kind: "builtin", id: key.slice(BUILTIN_COLUMN_PREFIX.length) };
  }
  if (key.startsWith(CUSTOM_COLUMN_PREFIX)) {
    return { kind: "custom", definitionId: key.slice(CUSTOM_COLUMN_PREFIX.length) };
  }
  return null;
}

/**
 * Reads the stored layout defensively.
 *
 * It is a `Json` column, so nothing at the database level guarantees its shape — an older
 * release, a hand-edited row or a failed write could leave anything in there. Returning `[]` for
 * junk lets `resolveColumns` fall back to the defaults rather than crashing the leads page.
 */
export function parseColumnLayout(stored: unknown): ColumnLayoutEntry[] {
  if (!Array.isArray(stored)) {
    return [];
  }

  const entries: ColumnLayoutEntry[] = [];

  for (const raw of stored) {
    if (typeof raw !== "object" || raw === null) {
      continue;
    }

    const candidate = raw as Record<string, unknown>;

    if (typeof candidate.key !== "string" || parseColumnKey(candidate.key) === null) {
      continue;
    }

    entries.push({
      key: candidate.key,
      visible: candidate.visible !== false,
      width: clampWidth(typeof candidate.width === "number" ? candidate.width : DEFAULT_COLUMN_WIDTH),
    });
  }

  return entries;
}

/**
 * The layout in the shape Prisma will accept for a `Json` column.
 *
 * TypeScript won't structurally match an array of interfaces against Prisma's `InputJsonValue`,
 * which requires an index signature the interface doesn't declare. The values really are plain
 * JSON — `parseColumnLayout` is what guarantees that on the way back out — so the assertion is
 * confined here rather than repeated at every write.
 */
export function serialiseColumnLayout(entries: ColumnLayoutEntry[]): Prisma.InputJsonValue {
  return entries as unknown as Prisma.InputJsonValue;
}

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_COLUMN_WIDTH;
  }

  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}

/**
 * Turns the stored layout into the columns to render.
 *
 * Anything in the layout that no longer resolves — a retired field, a builtin that was renamed
 * in a later release — is dropped rather than rendered as a blank column. Anything that resolves
 * but is missing from the layout is appended visible, which is what makes a newly created custom
 * field appear in the table without a second trip to the layout editor.
 */
export function resolveColumns(
  layout: ColumnLayoutEntry[],
  definitions: CustomFieldDefinitionSummary[],
): ResolvedColumn[] {
  const builtinById = new Map(BUILTIN_COLUMNS.map((column) => [column.id, column]));
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

  const resolved: ResolvedColumn[] = [];
  const seen = new Set<string>();

  for (const entry of layout) {
    const parsed = parseColumnKey(entry.key);

    if (!parsed || seen.has(entry.key)) {
      continue;
    }

    if (parsed.kind === "builtin") {
      const builtin = builtinById.get(parsed.id);
      if (!builtin) {
        continue;
      }
      seen.add(entry.key);
      resolved.push(fromBuiltin(builtin, entry.visible, entry.width));
      continue;
    }

    const definition = definitionById.get(parsed.definitionId);
    if (!definition) {
      continue;
    }
    seen.add(entry.key);
    resolved.push(fromDefinition(definition, entry.visible, entry.width));
  }

  // Everything the layout never mentioned. Builtins default to whatever a fresh install shows;
  // custom fields default to visible, because an admin who just created one expects to see it.
  for (const builtin of BUILTIN_COLUMNS) {
    const key = builtinColumnKey(builtin.id);
    if (!seen.has(key)) {
      resolved.push(
        fromBuiltin(builtin, DEFAULT_VISIBLE_BUILTINS.includes(builtin.id), builtin.defaultWidth),
      );
    }
  }

  for (const definition of definitions) {
    const key = customColumnKey(definition.id);
    if (!seen.has(key)) {
      resolved.push(fromDefinition(definition, true, defaultWidthForKind(definition.kind)));
    }
  }

  // The name column is how a row is opened, so it can never be hidden or moved off the front.
  return resolved.sort((left, right) => Number(right.isLocked) - Number(left.isLocked));
}

export function visibleColumns(columns: ResolvedColumn[]): ResolvedColumn[] {
  return columns.filter((column) => column.visible || column.isLocked);
}

function fromBuiltin(builtin: BuiltinColumn, visible: boolean, width: number): ResolvedColumn {
  return {
    key: builtinColumnKey(builtin.id),
    label: builtin.label,
    width: clampWidth(width),
    visible: builtin.isLocked ? true : visible,
    sortKey: builtin.sortKey,
    builtin,
    definition: null,
    isLocked: Boolean(builtin.isLocked),
  };
}

function fromDefinition(
  definition: CustomFieldDefinitionSummary,
  visible: boolean,
  width: number,
): ResolvedColumn {
  return {
    key: customColumnKey(definition.id),
    label: definition.label,
    width: clampWidth(width),
    visible,
    // A multi-select has no meaningful order and a long text column would sort by its opening
    // words, which reads like noise. Both render; neither offers a sort control.
    sortKey: isSortableKind(definition.kind) ? customColumnKey(definition.id) : null,
    builtin: null,
    definition,
    isLocked: false,
  };
}

function defaultWidthForKind(kind: CustomFieldKind): number {
  switch (kind) {
    case CustomFieldKind.CHECKBOX:
      return 100;
    case CustomFieldKind.LONG_TEXT:
      return 260;
    case CustomFieldKind.DATE:
    case CustomFieldKind.NUMBER:
      return 130;
    default:
      return DEFAULT_COLUMN_WIDTH;
  }
}

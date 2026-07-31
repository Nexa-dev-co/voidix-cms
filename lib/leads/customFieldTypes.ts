import { CustomFieldKind } from "@/generated/prisma/enums";
import { toPlainLine } from "@/lib/text/plainText";
import { isSafeLinkUrl } from "@/lib/validation/contentSchemas";

/**
 * Everything about custom fields that does NOT touch the database.
 *
 * Split out from `customFields.ts` so the table, the wizard and the field inputs — all Client
 * Components — can use the shapes and the coercion rules without dragging the Prisma client into
 * the browser bundle behind them.
 */

/**
 * Length caps for admin-defined fields.
 *
 * Same reasoning as `FIELD_LIMITS` for site copy: one place, so the counter an editor sees and
 * the limit the server enforces cannot drift.
 */
export const CUSTOM_FIELD_LIMITS = {
  label: 60,
  key: 64,
  helpText: 200,
  text: 500,
  longText: 4000,
  url: 500,
  option: 60,
  optionCount: 50,
} as const;

/** The prefix a custom field's input carries in a form, so the parser can find it by definition. */
export const CUSTOM_FIELD_INPUT_PREFIX = "custom_";

export interface CustomFieldDefinitionSummary {
  id: string;
  key: string;
  label: string;
  kind: CustomFieldKind;
  options: string[];
  helpText: string | null;
  sortOrder: number;
  isActive: boolean;
}

/**
 * One field's value for one person, in a shape that survives the trip to a Client Component.
 *
 * Prisma hands back `Decimal` instances and `Date` objects, neither of which React can serialise
 * into a client payload. Flattening to strings here rather than at each call site means there is
 * one place to get it right.
 */
export interface CustomFieldCell {
  definitionId: string;
  /** What a table cell or detail row shows. Empty when nothing is recorded. */
  display: string;
  /** What an input is pre-filled with. `YYYY-MM-DD` for dates, `"true"`/`""` for checkboxes. */
  inputValue: string;
  /** Only populated for MULTI_SELECT. */
  selectedOptions: string[];
  isSet: boolean;
}

/** The stored row for one value, as Prisma returns it. */
export interface StoredFieldValue {
  definitionId: string;
  valueText: string | null;
  valueNumber: { toString(): string } | null;
  valueDate: Date | null;
  valueBoolean: boolean | null;
  valueOptions: string[];
}

export interface FieldValueColumns {
  valueText: string | null;
  valueNumber: string | null;
  valueDate: Date | null;
  valueBoolean: boolean | null;
  valueOptions: string[];
}

export type ParsedFieldValue =
  | { ok: true; data: FieldValueColumns; isEmpty: boolean }
  | { ok: false; error: string };

/** Which value column a kind reads and writes. Also the column the table sorts on. */
export function valueColumnForKind(
  kind: CustomFieldKind,
): "valueText" | "valueNumber" | "valueDate" | "valueBoolean" | "valueOptions" {
  switch (kind) {
    case CustomFieldKind.NUMBER:
      return "valueNumber";
    case CustomFieldKind.DATE:
      return "valueDate";
    case CustomFieldKind.CHECKBOX:
      return "valueBoolean";
    case CustomFieldKind.MULTI_SELECT:
      return "valueOptions";
    default:
      return "valueText";
  }
}

/** Whether ordering the table by this kind produces something a person would call sorted. */
export function isSortableKind(kind: CustomFieldKind): boolean {
  return kind !== CustomFieldKind.MULTI_SELECT && kind !== CustomFieldKind.LONG_TEXT;
}

export function kindNeedsOptions(kind: CustomFieldKind): boolean {
  return kind === CustomFieldKind.SINGLE_SELECT || kind === CustomFieldKind.MULTI_SELECT;
}

/**
 * Turns one spreadsheet cell into the value list `parseFieldValue` expects.
 *
 * A multi-select arrives as a single cell — `"Web, 3D, Branding"` — because a spreadsheet has no
 * way to put three values in one column. Everything else is one value, and splitting it would
 * mangle a company name with a comma in it.
 */
export function splitImportedCell(definition: CustomFieldDefinitionSummary, raw: string): string[] {
  if (definition.kind !== CustomFieldKind.MULTI_SELECT) {
    return [raw];
  }

  return raw
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Best guess at which spreadsheet column holds which custom field.
 *
 * Deliberately simpler than the scored matcher the builtin fields use: those have to cope with
 * "E-mail Address" and "Organisation Name" out of files nobody here wrote, whereas a custom
 * field's label was typed by the same admin doing the import. Case and punctuation are the only
 * things forgiven, and every guess is shown for confirmation anyway.
 */
export function guessCustomFieldColumns(
  headers: string[],
  definitions: CustomFieldDefinitionSummary[],
): Record<string, number | null> {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalisedHeaders = headers.map(normalise);
  const mapping: Record<string, number | null> = {};

  for (const definition of definitions) {
    const target = normalise(definition.label);
    const index = normalisedHeaders.indexOf(target);
    mapping[definition.id] = index === -1 ? null : index;
  }

  return mapping;
}

const EMPTY_CELL = { display: "", inputValue: "", selectedOptions: [], isSet: false };

const EMPTY_COLUMNS: FieldValueColumns = {
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueBoolean: null,
  valueOptions: [],
};

/** Turns a stored row into the serialisable cell the UI renders. */
export function toCustomFieldCell(
  definition: CustomFieldDefinitionSummary,
  stored: StoredFieldValue | undefined,
): CustomFieldCell {
  if (!stored) {
    return { definitionId: definition.id, ...EMPTY_CELL };
  }

  switch (definition.kind) {
    case CustomFieldKind.NUMBER: {
      if (stored.valueNumber === null) {
        return { definitionId: definition.id, ...EMPTY_CELL };
      }
      // Decimal keeps trailing zeros from the column's scale ("25000.0000"); nobody wants to read
      // a budget that way, so they are dropped for both display and the input.
      const exact = trimTrailingZeros(stored.valueNumber.toString());
      return {
        definitionId: definition.id,
        display: exact,
        inputValue: exact,
        selectedOptions: [],
        isSet: true,
      };
    }

    case CustomFieldKind.DATE: {
      if (stored.valueDate === null) {
        return { definitionId: definition.id, ...EMPTY_CELL };
      }
      return {
        definitionId: definition.id,
        display: formatDisplayDate(stored.valueDate),
        inputValue: stored.valueDate.toISOString().slice(0, 10),
        selectedOptions: [],
        isSet: true,
      };
    }

    case CustomFieldKind.CHECKBOX: {
      if (stored.valueBoolean === null) {
        return { definitionId: definition.id, ...EMPTY_CELL };
      }
      return {
        definitionId: definition.id,
        display: stored.valueBoolean ? "Yes" : "No",
        inputValue: stored.valueBoolean ? "true" : "",
        selectedOptions: [],
        isSet: true,
      };
    }

    case CustomFieldKind.MULTI_SELECT: {
      if (stored.valueOptions.length === 0) {
        return { definitionId: definition.id, ...EMPTY_CELL };
      }
      return {
        definitionId: definition.id,
        display: stored.valueOptions.join(", "),
        inputValue: "",
        selectedOptions: stored.valueOptions,
        isSet: true,
      };
    }

    default: {
      if (!stored.valueText) {
        return { definitionId: definition.id, ...EMPTY_CELL };
      }
      return {
        definitionId: definition.id,
        display: stored.valueText,
        inputValue: stored.valueText,
        selectedOptions: [],
        isSet: true,
      };
    }
  }
}

/**
 * Validates and coerces what a form submitted into the typed columns.
 *
 * A value that fails is refused rather than quietly dropped — a salesperson who typed "twenty
 * five k" into a Budget field should be told, not have it silently vanish on save.
 */
export function parseFieldValue(
  definition: CustomFieldDefinitionSummary,
  rawValues: string[],
): ParsedFieldValue {
  switch (definition.kind) {
    case CustomFieldKind.NUMBER: {
      const raw = toPlainLine(rawValues[0] ?? "");
      if (raw.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      // Tolerate the thousands separators people paste out of spreadsheets.
      const cleaned = raw.replace(/[\s,]/g, "");
      if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
        return { ok: false, error: `${definition.label} must be a number.` };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueNumber: cleaned }, isEmpty: false };
    }

    case CustomFieldKind.DATE: {
      const raw = toPlainLine(rawValues[0] ?? "");
      if (raw.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return { ok: false, error: `${definition.label} must be a date.` };
      }
      // Parsed as UTC midnight to match the DATE column. Letting the runtime apply a local offset
      // is how a date shifts a day between the server and whoever reads it back.
      const parsed = new Date(`${raw}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: `${definition.label} isn't a real date.` };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueDate: parsed }, isEmpty: false };
    }

    case CustomFieldKind.CHECKBOX: {
      // An unchecked box submits nothing at all, which is the "false" case rather than "unset".
      const isChecked = rawValues.some((value) => value === "true" || value === "on");
      return { ok: true, data: { ...EMPTY_COLUMNS, valueBoolean: isChecked }, isEmpty: false };
    }

    case CustomFieldKind.URL: {
      const raw = toPlainLine(rawValues[0] ?? "");
      if (raw.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      if (raw.length > CUSTOM_FIELD_LIMITS.url) {
        return {
          ok: false,
          error: `${definition.label} must be ${CUSTOM_FIELD_LIMITS.url} characters or fewer.`,
        };
      }
      // Reuses the site's link check, which rejects `javascript:` and other schemes that turn a
      // stored value into an attack on whoever clicks it in the panel.
      if (!isSafeLinkUrl(raw)) {
        return { ok: false, error: `${definition.label} must be a http(s) link.` };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueText: raw }, isEmpty: false };
    }

    case CustomFieldKind.SINGLE_SELECT: {
      const raw = toPlainLine(rawValues[0] ?? "");
      if (raw.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      if (!definition.options.includes(raw)) {
        return { ok: false, error: `"${raw}" isn't one of the ${definition.label} options.` };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueText: raw }, isEmpty: false };
    }

    case CustomFieldKind.MULTI_SELECT: {
      const chosen = rawValues
        .map((value) => toPlainLine(value))
        .filter((value) => value.length > 0);
      const unknown = chosen.find((value) => !definition.options.includes(value));
      if (unknown) {
        return { ok: false, error: `"${unknown}" isn't one of the ${definition.label} options.` };
      }
      // Order follows the definition rather than submission order, so two people ticking the same
      // boxes produce the same stored value.
      const ordered = definition.options.filter((option) => chosen.includes(option));
      return {
        ok: true,
        data: { ...EMPTY_COLUMNS, valueOptions: ordered },
        isEmpty: ordered.length === 0,
      };
    }

    case CustomFieldKind.LONG_TEXT: {
      const cleaned = toPlainLine(rawValues[0] ?? "");
      if (cleaned.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      if (cleaned.length > CUSTOM_FIELD_LIMITS.longText) {
        return {
          ok: false,
          error: `${definition.label} must be ${CUSTOM_FIELD_LIMITS.longText} characters or fewer.`,
        };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueText: cleaned }, isEmpty: false };
    }

    default: {
      const cleaned = toPlainLine(rawValues[0] ?? "");
      if (cleaned.length === 0) {
        return { ok: true, data: EMPTY_COLUMNS, isEmpty: true };
      }
      if (cleaned.length > CUSTOM_FIELD_LIMITS.text) {
        return {
          ok: false,
          error: `${definition.label} must be ${CUSTOM_FIELD_LIMITS.text} characters or fewer.`,
        };
      }
      return { ok: true, data: { ...EMPTY_COLUMNS, valueText: cleaned }, isEmpty: false };
    }
  }
}

function trimTrailingZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

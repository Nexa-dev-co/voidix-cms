import ExcelJS from "exceljs";

import { matchColumns } from "@/lib/leads/columnMatching";

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** The fields an uploaded file can map onto. `email` is the only one that must be present. */
export const IMPORT_FIELDS = [
  { key: "name", label: "Name", required: false },
  { key: "email", label: "Email", required: true },
  { key: "company", label: "Company", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "message", label: "Notes", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

/**
 * Reads the first worksheet out of an .xlsx or .csv upload.
 *
 * Uses ExcelJS rather than the `xlsx` package: SheetJS moved distribution off npm, so the
 * registry copy is frozen at 0.18.5 with unpatched prototype-pollution advisories, and this
 * parser handles files uploaded by people rather than files we control.
 */
export async function parseSpreadsheet(
  file: File,
  maxRows: number = IMPORT_MAX_ROWS,
): Promise<ParsedSheet> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new Error(`That file is larger than ${IMPORT_MAX_BYTES / 1024 / 1024}MB.`);
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  if (isCsv) {
    // ExcelJS's CSV reader wants a stream; decoding here keeps the call site uniform and
    // sidesteps its encoding guesswork on small files.
    const text = new TextDecoder().decode(buffer);
    return parseCsvText(text, maxRows);
  }

  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("That workbook has no sheets in it.");
  }

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      values.push(cellToString(cell.value));
    });
    rows.push(values);
  });

  return splitHeaderRow(rows, maxRows);
}

function parseCsvText(text: string, maxRows: number): ParsedSheet {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (isQuoted) {
      if (character === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          isQuoted = false;
        }
      } else {
        currentValue += character;
      }
      continue;
    }

    if (character === '"') {
      isQuoted = true;
    } else if (character === ",") {
      currentRow.push(currentValue);
      currentValue = "";
    } else if (character === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
    } else if (character !== "\r") {
      currentValue += character;
    }
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return splitHeaderRow(
    rows.filter((row) => row.some((value) => value.trim().length > 0)),
    maxRows,
  );
}

function splitHeaderRow(rows: string[][], maxRows: number): ParsedSheet {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    throw new Error("That file appears to be empty.");
  }

  if (dataRows.length > maxRows) {
    throw new Error(
      `That file has ${dataRows.length} rows — the limit is ${maxRows} per import. An admin can raise it under Settings.`,
    );
  }

  return {
    headers: headerRow.map((header) => header.trim()),
    rows: dataRows,
  };
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    // Excel hands back rich text, hyperlinks and formula results as objects. An email typed
    // as a mailto: link is the common case and would otherwise come through as "[object Object]".
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.replace(/^mailto:/i, "");
    }
    if ("result" in value) {
      return String(value.result ?? "");
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return "";
  }

  return String(value);
}

/**
 * Best guess at which column is which, so a well-formed file needs no manual mapping.
 * Always shown to the operator for confirmation rather than applied silently.
 */
export function guessColumnMapping(headers: string[]): Record<ImportFieldKey, number | null> {
  return matchColumns(headers);
}

/**
 * A few example values per column, shown under each mapping dropdown.
 *
 * Headers lie — "Contact" could be a person or a phone number — so the fastest way to confirm
 * a mapping is to see what's actually in the column.
 */
export function collectColumnSamples(
  rows: string[][],
  headerCount: number,
  sampleSize = 3,
): string[][] {
  const samples: string[][] = Array.from({ length: headerCount }, () => []);

  for (const row of rows) {
    if (samples.every((column) => column.length >= sampleSize)) {
      break;
    }

    for (let index = 0; index < headerCount; index += 1) {
      const value = (row[index] ?? "").trim();
      if (value.length > 0 && samples[index].length < sampleSize) {
        samples[index].push(value);
      }
    }
  }

  return samples;
}

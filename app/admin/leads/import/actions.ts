"use server";

import { revalidatePath } from "next/cache";

import { EnquirySource } from "@/generated/prisma/enums";
import { requireMember, type CurrentMember } from "@/lib/auth";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import {
  buildImportPlan,
  DEFAULT_MATCH_ACTION,
  type MatchAction,
  type PlannedRow,
} from "@/lib/leads/importPlan";
import {
  IDLE_IMPORT_RESULT,
  IDLE_IMPORT_STATE,
  type ImportPreviewState,
  type ImportResultState,
} from "@/lib/leads/importState";
import {
  collectColumnSamples,
  guessColumnMapping,
  parseSpreadsheet,
  type ImportFieldKey,
} from "@/lib/leads/spreadsheet";
import { prisma } from "@/lib/prisma";

function importError(message: string): ImportPreviewState {
  return { ...IDLE_IMPORT_STATE, status: "error", message };
}

/**
 * Step one and two: parse the upload, then work out what committing it would do.
 *
 * Writes nothing. Re-runs whenever the column mapping changes, so adjusting a dropdown
 * re-plans the whole file against the same parsed rows.
 */
export async function previewImportAction(
  previousState: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  await requireMember();

  const settings = await getLeadSettings();
  const file = formData.get("file");
  const isRemap = formData.get("intent") === "remap";

  let headers = previousState.headers;
  let rows = previousState.rows;
  let filename = previousState.filename;

  if (!isRemap) {
    if (!(file instanceof File) || file.size === 0) {
      return importError("Choose a .xlsx or .csv file first.");
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
      return importError("Only .xlsx and .csv files can be imported.");
    }

    try {
      const parsed = await parseSpreadsheet(file, settings.importMaxRows);
      headers = parsed.headers;
      rows = parsed.rows;
      filename = file.name;
    } catch (error) {
      return importError(error instanceof Error ? error.message : "That file couldn't be read.");
    }
  }

  if (rows.length === 0) {
    return importError("That file has a header row but no data.");
  }

  const mapping = isRemap ? readMappingFromForm(formData, headers) : guessColumnMapping(headers);

  if (mapping.email === null) {
    return {
      status: "error",
      message:
        "No email column found. Email is the field that identifies a person, so it has to be mapped — pick it below.",
      filename,
      headers,
      mapping,
      plan: null,
      rows,
      samples: collectColumnSamples(rows, headers.length),
      defaultMatchAction: settings.importDefaultMatchAction,
      allowOverwrite: settings.importAllowOverwrite,
    };
  }

  const plan = await buildImportPlan(rows, mapping);

  return {
    status: "ready",
    message: null,
    filename,
    headers,
    mapping,
    plan,
    rows,
    samples: collectColumnSamples(rows, headers.length),
    defaultMatchAction: settings.importDefaultMatchAction,
    allowOverwrite: settings.importAllowOverwrite,
  };
}

function readMappingFromForm(
  formData: FormData,
  headers: string[],
): Record<ImportFieldKey, number | null> {
  const readColumn = (field: ImportFieldKey) => {
    const raw = String(formData.get(`column_${field}`) ?? "");
    const index = Number(raw);

    return raw !== "" && Number.isInteger(index) && index >= 0 && index < headers.length
      ? index
      : null;
  };

  return {
    name: readColumn("name"),
    email: readColumn("email"),
    company: readColumn("company"),
    phone: readColumn("phone"),
    message: readColumn("message"),
  };
}

/**
 * Step three: actually write the import.
 *
 * Re-plans from the submitted rows rather than trusting a plan posted back from the browser —
 * the client could have altered it, and the database may have changed since the preview was
 * generated. The preview is a forecast; this is the decision.
 */
export async function commitImportAction(
  _previousState: ImportResultState,
  formData: FormData,
): Promise<ImportResultState> {
  const member = await requireMember();

  const filename = String(formData.get("filename") ?? "import");
  const rowsJson = String(formData.get("rows") ?? "");
  const mappingJson = String(formData.get("mapping") ?? "");

  let rows: string[][];
  let mapping: Record<ImportFieldKey, number | null>;

  try {
    rows = JSON.parse(rowsJson);
    mapping = JSON.parse(mappingJson);
  } catch {
    return { ...IDLE_IMPORT_RESULT, status: "error", message: "That import expired — upload the file again." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ...IDLE_IMPORT_RESULT, status: "error", message: "Nothing to import." };
  }

  const settings = await getLeadSettings();
  const plan = await buildImportPlan(rows, mapping);
  const matchActions = readMatchActions(formData, plan.rows, settings);
  const assignment = await resolveAssignment(formData, member);

  const batch = await prisma.importBatch.create({
    data: { filename, importedById: member.id },
  });

  let created = 0;
  let enriched = 0;
  let logged = 0;
  let skipped = 0;

  for (const row of plan.rows) {
    if (row.outcome === "invalid" || row.outcome === "duplicate-in-file") {
      skipped += 1;
      continue;
    }

    if (row.outcome === "create") {
      const assignedToId = assignment.next();

      await prisma.contact.create({
        data: {
          name: row.name,
          email: row.email,
          company: row.company,
          phone: row.phone,
          assignedToId,
          assignedAt: assignedToId ? new Date() : null,
          enquiries: {
            create: [
              { source: EnquirySource.IMPORT, message: row.message, importBatchId: batch.id },
            ],
          },
        },
      });
      created += 1;
      continue;
    }

    const action = matchActions.get(row.rowNumber) ?? DEFAULT_MATCH_ACTION;

    if (action === "skip" || !row.existingContactId) {
      skipped += 1;
      continue;
    }

    await prisma.enquiry.create({
      data: {
        contactId: row.existingContactId,
        source: EnquirySource.IMPORT,
        message: row.message,
        importBatchId: batch.id,
      },
    });

    if (action === "log") {
      logged += 1;
      continue;
    }

    const existing = await prisma.contact.findUnique({
      where: { id: row.existingContactId },
      select: { name: true, company: true, phone: true },
    });

    if (!existing) {
      logged += 1;
      continue;
    }

    // "enrich" only writes where the record is currently blank; "overwrite" prefers the
    // spreadsheet but still won't blank a field the file left empty.
    const data =
      action === "overwrite"
        ? {
            name: row.name || existing.name,
            company: row.company ?? existing.company,
            phone: row.phone ?? existing.phone,
          }
        : {
            company: existing.company ?? row.company,
            phone: existing.phone ?? row.phone,
          };

    await prisma.contact.update({ where: { id: row.existingContactId }, data });
    enriched += 1;
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      createdCount: created,
      enrichedCount: enriched,
      loggedCount: logged,
      skippedCount: skipped,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/leads");

  return {
    status: "done",
    message: `${created} added, ${enriched} enriched, ${logged} logged, ${skipped} skipped.`,
    created,
    enriched,
    logged,
    skipped,
  };
}

/**
 * Turns the assignment step's choice into a function that names an owner per created contact.
 *
 * "Split evenly" deals round-robin through the chosen people in order rather than computing
 * fixed block sizes, so an odd count distributes as evenly as it can (7 leads across 3 people
 * gives 3/2/2) instead of leaving a remainder for the last person.
 *
 * Only an admin may assign on import — a salesperson importing a list gets it themselves,
 * which is the only owner they're allowed to set.
 */
async function resolveAssignment(formData: FormData, member: CurrentMember) {
  const mode = String(formData.get("assignMode") ?? "later");

  if (member.role !== "ADMIN") {
    return { next: () => member.id };
  }

  if (mode === "one") {
    const memberId = String(formData.get("assignToMemberId") ?? "");
    const target = memberId
      ? await prisma.teamMember.findFirst({ where: { id: memberId, isActive: true } })
      : null;

    return { next: () => target?.id ?? null };
  }

  if (mode === "split") {
    const selectedIds = formData.getAll("splitMemberIds").map((value) => String(value));
    const targets = await prisma.teamMember.findMany({
      where: { id: { in: selectedIds }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true },
    });

    if (targets.length === 0) {
      return { next: () => null };
    }

    let cursor = 0;
    return {
      next: () => {
        const target = targets[cursor % targets.length];
        cursor += 1;
        return target.id;
      },
    };
  }

  return { next: () => null };
}

function readMatchActions(
  formData: FormData,
  rows: PlannedRow[],
  settings: { importDefaultMatchAction: string; importAllowOverwrite: boolean },
): Map<number, MatchAction> {
  const actions = new Map<number, MatchAction>();
  const bulk = String(formData.get("bulkMatchAction") ?? "");
  const fallback = isMatchAction(settings.importDefaultMatchAction)
    ? settings.importDefaultMatchAction
    : DEFAULT_MATCH_ACTION;

  for (const row of rows) {
    if (row.outcome !== "match") {
      continue;
    }

    const raw = String(formData.get(`match_${row.rowNumber}`) ?? "");
    const candidate = raw || bulk;
    const chosen = isMatchAction(candidate) ? candidate : fallback;

    // Enforced here rather than only hidden in the UI — the form is a POST endpoint, so a
    // disallowed value could otherwise be submitted directly.
    actions.set(
      row.rowNumber,
      chosen === "overwrite" && !settings.importAllowOverwrite ? "enrich" : chosen,
    );
  }

  return actions;
}

function isMatchAction(value: string): value is MatchAction {
  return value === "enrich" || value === "log" || value === "overwrite" || value === "skip";
}

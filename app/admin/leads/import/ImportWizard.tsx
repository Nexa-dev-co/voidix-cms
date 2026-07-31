"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { commitImportAction, previewImportAction } from "@/app/admin/leads/import/actions";
import { AssignStep, type AssignableMember } from "@/app/admin/leads/import/AssignStep";
import { IDLE_IMPORT_RESULT, IDLE_IMPORT_STATE } from "@/lib/leads/importState";
import { buttonClasses } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IMPORT_FIELDS, type ImportFieldKey } from "@/lib/leads/spreadsheet";
import type { MatchAction, PlannedRow, RowOutcome } from "@/lib/leads/importPlan";

const OUTCOME_STYLES: Record<RowOutcome, { label: string; className: string }> = {
  create: { label: "New", className: "text-success border-success/30" },
  match: { label: "Already here", className: "text-warning border-warning/30" },
  "duplicate-in-file": { label: "Repeat in file", className: "text-muted border-border-strong" },
  invalid: { label: "Rejected", className: "text-danger border-danger/30" },
};

const ALL_MATCH_OPTIONS: { value: MatchAction; label: string; hint: string }[] = [
  { value: "enrich", label: "Fill blanks", hint: "Adds to history, fills only empty fields" },
  { value: "log", label: "History only", hint: "Adds to history, changes nothing else" },
  { value: "overwrite", label: "Overwrite", hint: "Adds to history, replaces name/company/phone" },
  { value: "skip", label: "Ignore", hint: "Does nothing at all" },
];

const CONTROL_CLASSES =
  "rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

export function ImportWizard({
  members,
  canAssign,
}: {
  members: AssignableMember[];
  canAssign: boolean;
}) {
  const [preview, previewAction] = useActionState(previewImportAction, IDLE_IMPORT_STATE);
  const [result, commitAction] = useActionState(commitImportAction, IDLE_IMPORT_RESULT);
  const [bulkAction, setBulkAction] = useState<MatchAction | "">("");

  if (result.status === "done") {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-sm border border-success/40 bg-success/5 px-4 py-3 text-sm text-success">
          {result.message}
        </div>
        <div className="flex gap-3">
          <Link href="/admin/leads" className={buttonClasses("primary")}>
            View leads
          </Link>
          <Link href="/admin/leads/import" className={buttonClasses("secondary")}>
            Import another
          </Link>
        </div>
      </div>
    );
  }

  // "Overwrite" disappears when an admin has turned it off in Settings. The server enforces
  // the same rule, so removing it here is convenience rather than the control itself.
  const matchOptions = preview.allowOverwrite
    ? ALL_MATCH_OPTIONS
    : ALL_MATCH_OPTIONS.filter((option) => option.value !== "overwrite");

  const plan = preview.plan;
  const matchRows = plan?.rows.filter((row) => row.outcome === "match") ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Step 1 — upload */}
      <form action={previewAction} className="flex flex-col gap-3">
        <label className="text-xs uppercase tracking-[0.14em] text-muted">Spreadsheet</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx,.csv"
            required
            className="min-w-0 flex-1 rounded-sm border border-border bg-field px-3 py-2 text-sm text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-card file:px-3 file:py-1 file:text-xs file:text-fg"
          />
          <SubmitButton pendingLabel="Reading…" variant="secondary">
            Read file
          </SubmitButton>
        </div>
        <p className="text-[11px] text-muted">
          .xlsx or .csv, first sheet, first row treated as headers. Nothing is saved until you
          confirm.
        </p>
        {preview.status === "error" && (
          <p className="text-xs text-danger">{preview.message}</p>
        )}
      </form>

      {/* Step 2 — column mapping. Re-plans the same parsed rows on change. */}
      {preview.headers.length > 0 && (
        <form action={previewAction} className="flex flex-col gap-4 border-t border-border pt-8">
          <input type="hidden" name="intent" value="remap" />
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">Columns</h2>
            <span className="text-[11px] text-muted">{preview.filename}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => {
              const mappedIndex = preview.mapping?.[field.key as ImportFieldKey] ?? null;

              return (
                <ColumnMapping
                  key={field.key}
                  label={field.label}
                  inputName={`column_${field.key}`}
                  isRequired={field.required}
                  mappedIndex={mappedIndex}
                  headers={preview.headers}
                  samples={preview.samples}
                />
              );
            })}
          </div>

          {preview.customFields.length > 0 && (
            <>
              <h3 className="eyebrow mt-2">Extra fields</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {preview.customFields.map((definition) => (
                  <ColumnMapping
                    key={definition.id}
                    label={definition.label}
                    inputName={`column_custom_${definition.id}`}
                    isRequired={false}
                    mappedIndex={preview.customMapping[definition.id] ?? null}
                    headers={preview.headers}
                    samples={preview.samples}
                    hint={
                      definition.kind === "MULTI_SELECT"
                        ? "One cell, comma separated — “Web, 3D”."
                        : undefined
                    }
                  />
                ))}
              </div>
            </>
          )}

          <div>
            <SubmitButton pendingLabel="Re-checking…" variant="secondary">
              Apply columns
            </SubmitButton>
          </div>
        </form>
      )}

      {/* Step 3 — preview and commit */}
      {plan && (
        <form action={commitAction} className="flex flex-col gap-4 border-t border-border pt-8">
          <input type="hidden" name="filename" value={preview.filename ?? "import"} />
          <input type="hidden" name="rows" value={JSON.stringify(preview.rows)} />
          <input type="hidden" name="mapping" value={JSON.stringify(preview.mapping)} />
          <input
            type="hidden"
            name="customMapping"
            value={JSON.stringify(preview.customMapping)}
          />

          <h2 className="eyebrow">Preview</h2>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(OUTCOME_STYLES) as RowOutcome[]).map((outcome) => (
              <span
                key={outcome}
                className={`rounded-sm border px-2 py-0.5 text-[11px] ${OUTCOME_STYLES[outcome].className}`}
              >
                {plan.counts[outcome]} {OUTCOME_STYLES[outcome].label.toLowerCase()}
              </span>
            ))}
          </div>

          {matchRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted">
                {matchRows.length} already here — set all to
              </span>
              <select
                value={bulkAction}
                onChange={(event) => setBulkAction(event.target.value as MatchAction | "")}
                className={CONTROL_CLASSES}
              >
                <option value="">choose per row</option>
                {matchOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="bulkMatchAction" value={bulkAction} />
            </div>
          )}

          <div className="max-h-[28rem] overflow-y-auto rounded-sm border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-muted">
                  <th className="px-3 py-2 font-normal">Row</th>
                  <th className="px-3 py-2 font-normal">Person</th>
                  <th className="px-3 py-2 font-normal">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.rows.map((row) => (
                  <PreviewRow
                    key={row.rowNumber}
                    row={row}
                    bulkAction={bulkAction}
                    matchOptions={matchOptions}
                    defaultMatchAction={preview.defaultMatchAction}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {canAssign && <AssignStep members={members} newLeadCount={plan.counts.create} />}

          <div className="flex items-center gap-3 border-t border-border pt-4">
            <SubmitButton pendingLabel="Importing…">
              {`Import ${plan.counts.create + plan.counts.match} of ${plan.rows.length}`}
            </SubmitButton>
            <Link href="/admin/leads" className={buttonClasses("ghost")}>
              Cancel
            </Link>
          </div>

          {result.status === "error" && <p className="text-xs text-danger">{result.message}</p>}
        </form>
      )}
    </div>
  );
}

/**
 * One "which column is this?" row.
 *
 * Shared by the builtin fields and the admin-defined ones so the two read identically — an
 * operator mapping a spreadsheet shouldn't have to notice which of their columns the CMS shipped
 * with and which somebody added last week.
 */
function ColumnMapping({
  label,
  inputName,
  isRequired,
  mappedIndex,
  headers,
  samples,
  hint,
}: {
  label: string;
  inputName: string;
  isRequired: boolean;
  mappedIndex: number | null;
  headers: string[];
  samples: string[][];
  hint?: string;
}) {
  const sampleValues = mappedIndex === null ? [] : (samples[mappedIndex] ?? []);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className={isRequired ? "text-fg" : "text-muted"}>
          {label}
          {isRequired && <span className="text-accent"> *</span>}
        </span>
        <select name={inputName} defaultValue={mappedIndex ?? ""} className={CONTROL_CLASSES}>
          <option value="">— none —</option>
          {headers.map((header, index) => (
            <option key={`${header}-${index}`} value={index}>
              {header || `Column ${index + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Headers lie; values don't. Showing what's actually in the column is the quickest way to
          catch a wrong mapping before it's committed. */}
      {sampleValues.length > 0 && (
        <p className="truncate text-right text-[11px] text-muted/60">
          {sampleValues.join(" · ")}
        </p>
      )}

      {hint && <p className="text-right text-[11px] text-muted/60">{hint}</p>}
    </div>
  );
}

function PreviewRow({
  row,
  bulkAction,
  matchOptions,
  defaultMatchAction,
}: {
  row: PlannedRow;
  bulkAction: MatchAction | "";
  matchOptions: { value: MatchAction; label: string; hint: string }[];
  defaultMatchAction: string;
}) {
  const style = OUTCOME_STYLES[row.outcome];

  return (
    <tr className="align-top">
      <td className="px-3 py-2 tabular-nums text-muted/60">{row.rowNumber}</td>
      <td className="px-3 py-2">
        <span className="text-fg">{row.name}</span>
        <span className="block text-muted">{row.email || "—"}</span>
        {row.existingSummary && (
          <span className="block text-[11px] text-muted/60">now: {row.existingSummary}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${style.className}`}>
          {style.label}
        </span>
        {row.reason && <span className="mt-1 block text-[11px] text-muted">{row.reason}</span>}
        {row.warnings.map((warning) => (
          <span key={warning} className="mt-1 block text-[11px] text-warning">
            {warning}
          </span>
        ))}
        {row.outcome === "match" && (
          <select
            name={`match_${row.rowNumber}`}
            // Keyed by the bulk value so changing the bulk selector visibly resets every row,
            // rather than leaving stale per-row values that quietly win at submit time.
            key={bulkAction}
            defaultValue={bulkAction || defaultMatchAction}
            className={`${CONTROL_CLASSES} mt-1.5`}
          >
            {matchOptions.map((option) => (
              <option key={option.value} value={option.value} title={option.hint}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </td>
    </tr>
  );
}

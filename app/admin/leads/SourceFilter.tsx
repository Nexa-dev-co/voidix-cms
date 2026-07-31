"use client";

import { useRouter } from "next/navigation";

import {
  ANY_SOURCE,
  batchFilterValue,
  ORIGIN_CHANNELS,
  ORIGIN_LABELS,
} from "@/lib/leads/leadOrigin";
import { buildLeadsHref, type LeadQueryParams } from "@/lib/leads/leadsView";

/** One spreadsheet, as the dropdown needs to describe it. */
export interface ImportBatchOption {
  id: string;
  filename: string;
  /** Formatted on the server — a date rendered in the browser's locale would not match the table. */
  addedOn: string;
  leadCount: number;
}

/**
 * Narrows the list to one channel, or to one spreadsheet.
 *
 * A single control beside the search box rather than a third row of tabs. The page already
 * carries two rows of them, and the comment above the first one records why: an earlier version
 * stacked three navs and put sixteen controls between the heading and the first lead. This adds
 * one element and can hold the import files, which no tab row could.
 *
 * Navigates on change like `AssignSelect`, and keeps its state in the URL like every other
 * filter, so a filtered view stays linkable.
 */
export function SourceFilter({
  params,
  batches,
}: {
  params: LeadQueryParams;
  batches: ImportBatchOption[];
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Filter by source</span>
      <select
        value={params.source}
        onChange={(event) => router.push(buildLeadsHref(params, { source: event.target.value }))}
        // Fixed width, because a `select` sizes itself to its longest option — one spreadsheet
        // called "q3-tradeshow-final-v2.xlsx" would otherwise stretch this to 300px and push the
        // search box onto a line of its own, costing a row of leads on a laptop. The full text is
        // still readable in the open list.
        className="w-40 rounded-sm border border-border bg-field px-2.5 py-1.5 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
      >
        <option value={ANY_SOURCE}>Any source</option>

        {ORIGIN_CHANNELS.map((channel) => (
          <option key={channel} value={channel}>
            {ORIGIN_LABELS[channel]}
          </option>
        ))}

        {batches.length > 0 && (
          <optgroup label="From a spreadsheet">
            {batches.map((batch) => (
              <option key={batch.id} value={batchFilterValue(batch.id)}>
                {batch.filename} — {batch.addedOn}, {batch.leadCount}{" "}
                {batch.leadCount === 1 ? "lead" : "leads"}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

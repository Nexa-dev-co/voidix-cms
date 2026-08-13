"use client";

import Link from "next/link";

import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/classNames";
import { ORIGIN_TONES } from "@/lib/leads/leadOrigin";
import { STAGE_TONES, type LeadRow } from "@/lib/leads/leadsView";

/**
 * The leads list on a phone.
 *
 * A ten-column table does not survive a 375px screen — it becomes a thing you drag sideways to
 * read one field at a time. So below `sm` the same rows render as cards instead, and the table
 * takes over from there.
 *
 * Deliberately a fixed set of fields rather than the admin's column layout. A card is a summary
 * you scan to find the right person; the whole record, custom fields included, is one tap away.
 * Honouring eight configurable columns here would just rebuild the problem vertically.
 */
export function LeadCards({
  rows,
  selectedIds,
  onToggle,
}: {
  rows: LeadRow[];
  selectedIds: Set<string>;
  onToggle: (leadId: string, isSelected: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((lead) => {
        const isSelected = selectedIds.has(lead.id);
        // Company and owner read as one line — two half-empty lines would be worse than one that
        // sometimes says only one of them.
        const secondary = [lead.company, lead.ownerName ?? "Unassigned"]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={lead.id}>
            <div
              className={cn(
                "relative rounded-sm border px-3 py-2.5 transition-colors duration-150",
                isSelected ? "border-accent/40 bg-card" : "border-border bg-bg",
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  aria-label={`Select ${lead.name}`}
                  onCheckedChange={(checked) => onToggle(lead.id, checked === true)}
                  className="mt-0.5 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    {/* The link covers the card via `after:inset-0`, so a tap anywhere opens the
                        lead while the checkbox above it still takes its own taps. One real link
                        rather than a click handler keeps it reachable by keyboard. */}
                    <Link
                      href={`/leads/${lead.id}`}
                      className="min-w-0 text-sm text-fg after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {lead.isOverdue && (
                          <span
                            aria-hidden
                            title="Follow-up overdue"
                            className="size-1.5 shrink-0 rounded-full bg-danger"
                          />
                        )}
                        <span className="truncate">{lead.name}</span>
                      </span>
                    </Link>

                    <span
                      className={cn(
                        "shrink-0 rounded-sm border px-1.5 py-0.5 text-[11px] leading-4",
                        STAGE_TONES[lead.stageKind] ?? STAGE_TONES.OPEN,
                      )}
                    >
                      {lead.stageLabel}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-muted">{lead.email}</p>

                  {secondary.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted/70">{secondary}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 text-[11px] leading-4",
                        ORIGIN_TONES[lead.sourceChannel],
                      )}
                    >
                      {lead.sourceLabel}
                    </span>
                    {lead.sourceDetail && (
                      <span className="min-w-0 truncate text-[11px] text-muted/60">
                        {lead.sourceDetail}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

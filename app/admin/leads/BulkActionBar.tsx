"use client";

import { useState } from "react";

import { bulkArchiveAction, bulkAssignAction, bulkStageAction } from "@/app/admin/leads/actions";
import { Button } from "@/components/ui/Button";
import { UNASSIGN_SENTINEL } from "@/lib/leads/leadsView";

const CONTROL_CLASSES =
  "rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

export interface BulkTarget {
  /** Stages this person may move leads into — terminal ones are absent without the setting. */
  stages: { id: string; label: string }[];
  /** Empty for Sales: handing leads around is an admin move. */
  members: { id: string; name: string }[];
  canAssign: boolean;
  /** True when looking at the archived view, which makes the button "Restore" instead. */
  showingArchived: boolean;
}

/**
 * Appears once rows are ticked.
 *
 * Everything here posts ids and lets the server decide. `filterPermittedIds` re-checks each one
 * and silently drops what the caller may not touch, because a selection can go stale between
 * being rendered and being submitted.
 */
export function BulkActionBar({
  selectedIds,
  target,
  onCleared,
}: {
  selectedIds: string[];
  target: BulkTarget;
  onCleared: () => void;
}) {
  const [stageId, setStageId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  if (selectedIds.length === 0) {
    return null;
  }

  const hiddenIds = selectedIds.map((id) => (
    <input key={id} type="hidden" name="ids" value={id} />
  ));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-sm border border-accent/30 bg-accent/5 px-3 py-2">
      <span className="text-xs text-accent">
        {selectedIds.length} selected
      </span>

      {target.stages.length > 0 && (
        <form action={bulkStageAction} onSubmit={onCleared} className="flex items-center gap-2">
          {hiddenIds}
          <select
            name="stageId"
            value={stageId}
            onChange={(event) => setStageId(event.target.value)}
            aria-label="Move to stage"
            className={CONTROL_CLASSES}
          >
            <option value="">Move to…</option>
            {target.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" disabled={stageId.length === 0}>
            Move
          </Button>
        </form>
      )}

      {target.canAssign && (
        <form action={bulkAssignAction} onSubmit={onCleared} className="flex items-center gap-2">
          {hiddenIds}
          <select
            name="assignedToId"
            value={assignedToId}
            onChange={(event) => setAssignedToId(event.target.value)}
            aria-label="Assign to"
            className={CONTROL_CLASSES}
          >
            <option value="">Assign to…</option>
            <option value={UNASSIGN_SENTINEL}>Nobody</option>
            {target.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" disabled={assignedToId.length === 0}>
            Assign
          </Button>
        </form>
      )}

      <form action={bulkArchiveAction} onSubmit={onCleared}>
        {hiddenIds}
        <input
          type="hidden"
          name="isArchived"
          value={target.showingArchived ? "false" : "true"}
        />
        <Button type="submit" variant="ghost">
          {target.showingArchived ? "Restore" : "Archive"}
        </Button>
      </form>
    </div>
  );
}

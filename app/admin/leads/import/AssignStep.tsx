"use client";

import { useState } from "react";

export interface AssignableMember {
  id: string;
  name: string;
  role: string;
}

/**
 * Who the newly created contacts belong to.
 *
 * Only shown to admins — a salesperson importing a list gets it themselves, because their
 * own name is the only owner they're permitted to set.
 *
 * The distribution preview is the point of this step: "142 leads → 71 Ahmed, 71 Mona" is
 * something you can sanity-check before committing, unlike a number you discover afterwards.
 */
export function AssignStep({
  members,
  newLeadCount,
}: {
  members: AssignableMember[];
  newLeadCount: number;
}) {
  const [mode, setMode] = useState<"later" | "one" | "split">("later");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const splitPreview = () => {
    if (selectedIds.length === 0) {
      return "Pick at least one person.";
    }

    const chosen = members.filter((member) => selectedIds.includes(member.id));
    const base = Math.floor(newLeadCount / chosen.length);
    const remainder = newLeadCount % chosen.length;

    return chosen
      .map((member, index) => `${base + (index < remainder ? 1 : 0)} ${member.name}`)
      .join(" · ");
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-sm border border-border p-4">
      <legend className="eyebrow px-1">Assign to</legend>

      {members.length === 0 ? (
        <p className="text-xs text-muted">
          No active team members to assign to. New leads will be left unassigned.
        </p>
      ) : (
        <>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="assignMode"
              value="later"
              checked={mode === "later"}
              onChange={() => setMode("later")}
              className="accent-[var(--accent)]"
            />
            Leave unassigned for now
          </label>

          <label className="flex flex-wrap items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="assignMode"
              value="one"
              checked={mode === "one"}
              onChange={() => setMode("one")}
              className="accent-[var(--accent)]"
            />
            All to
            <select
              name="assignToMemberId"
              disabled={mode !== "one"}
              className="rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg disabled:opacity-40 focus:border-accent focus:outline-none"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="assignMode"
              value="split"
              checked={mode === "split"}
              onChange={() => setMode("split")}
              className="accent-[var(--accent)]"
            />
            Split evenly between
          </label>

          {mode === "split" && (
            <div className="ml-6 flex flex-col gap-2">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {members.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="splitMemberIds"
                      value={member.id}
                      checked={selectedIds.includes(member.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id),
                        )
                      }
                      className="accent-[var(--accent)]"
                    />
                    {member.name}
                    <span className="text-muted/60">{member.role.toLowerCase()}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                {newLeadCount} new lead{newLeadCount === 1 ? "" : "s"} → {splitPreview()}
              </p>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted">
            Applies to newly created contacts only. People already in the system keep the owner
            they have — an import never reassigns someone else&rsquo;s lead.
          </p>
        </>
      )}
    </fieldset>
  );
}

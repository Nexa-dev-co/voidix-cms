"use client";

import { useActionState, useState } from "react";

import { saveLeadSettingsAction } from "@/app/(panel)/settings/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import type { LeadSettingsValues } from "@/lib/leads/leadSettings";

const SELECT_CLASSES =
  "rounded-sm border border-border bg-field px-2 py-1 text-xs text-fg transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none disabled:opacity-40";

const MATCH_ACTION_OPTIONS = [
  { value: "enrich", label: "Fill blanks" },
  { value: "log", label: "History only" },
  { value: "overwrite", label: "Overwrite" },
  { value: "skip", label: "Ignore" },
];

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        <span className="block text-[11px] leading-relaxed text-muted">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({
  settings,
  members,
}: {
  settings: LeadSettingsValues;
  members: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(saveLeadSettingsAction, IDLE_FORM_STATE);
  const [autoAssignMode, setAutoAssignMode] = useState(settings.autoAssignMode);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-2">New website leads</legend>
        <p className="mb-1 text-[11px] leading-relaxed text-muted">
          Where a lead from the site&rsquo;s contact form goes the moment it arrives.
        </p>

        {[
          { value: "UNASSIGNED", label: "Leave unassigned", hint: "An admin routes them by hand." },
          {
            value: "ROUND_ROBIN",
            label: "Round-robin between active sales",
            hint: "Rotates in name order, and the position survives restarts.",
          },
          { value: "FIXED", label: "Always assign to", hint: "One named person takes everything." },
        ].map((option) => (
          <label key={option.value} className="flex flex-wrap items-center gap-2.5 text-sm">
            <input
              type="radio"
              name="autoAssignMode"
              value={option.value}
              checked={autoAssignMode === option.value}
              onChange={() => setAutoAssignMode(option.value as typeof autoAssignMode)}
              className="accent-[var(--accent)]"
            />
            {option.label}
            {option.value === "FIXED" && (
              <select
                name="autoAssignMemberId"
                defaultValue={settings.autoAssignMemberId ?? ""}
                disabled={autoAssignMode !== "FIXED"}
                className={SELECT_CLASSES}
              >
                <option value="">— pick someone —</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            )}
            <span className="w-full pl-6 text-[11px] text-muted sm:w-auto sm:pl-0">
              {option.hint}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t border-border pt-8">
        <legend className="eyebrow mb-2">What Sales can do</legend>
        <p className="mb-1 text-[11px] leading-relaxed text-muted">
          Sales always see leads assigned to them, and never see site copy or publishing.
        </p>

        <Toggle
          name="salesCanEditContact"
          label="Edit contact details"
          hint="Change a name, company or phone number on their own leads."
          defaultChecked={settings.salesCanEditContact}
        />
        <Toggle
          name="salesCanClaimUnassigned"
          label="See and claim unassigned leads"
          hint="Opens the unassigned pool to them. Off means an admin assigns everything first."
          defaultChecked={settings.salesCanClaimUnassigned}
        />
        <Toggle
          name="salesCanExport"
          label="Export leads"
          hint="Download their leads as a spreadsheet. Off keeps the list inside the panel."
          defaultChecked={settings.salesCanExport}
        />
        <Toggle
          name="salesCanSeeOthersAttempts"
          label="See other people's attempts"
          hint="Off means each salesperson sees only their own call history on a lead."
          defaultChecked={settings.salesCanSeeOthersAttempts}
        />
        <Toggle
          name="salesCanCloseLeads"
          label="Mark leads won or lost"
          hint="Off means Sales move leads through the open stages and an admin closes them — the numbers the business reports on aren't self-declared."
          defaultChecked={settings.salesCanCloseLeads}
        />
        <Toggle
          name="salesCanEditCustomFields"
          label="Edit the extra fields"
          hint="The admin-defined fields on a contact. Off means Sales can read them but not change them."
          defaultChecked={settings.salesCanEditCustomFields}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-border pt-8">
        <legend className="eyebrow mb-2">Imports</legend>

        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            Default for rows that already exist
            <span className="block text-[11px] text-muted">
              What the per-row dropdown starts on in the preview.
            </span>
          </span>
          <select
            name="importDefaultMatchAction"
            defaultValue={settings.importDefaultMatchAction}
            className={SELECT_CLASSES}
          >
            {MATCH_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="min-w-0">
            Max rows per import
            <span className="block text-[11px] text-muted">
              A guard against a mis-selected file, not a hard capability limit.
            </span>
          </span>
          <input
            type="number"
            name="importMaxRows"
            min={1}
            max={20000}
            defaultValue={settings.importMaxRows}
            className={`${SELECT_CLASSES} w-24`}
          />
        </label>

        <Toggle
          name="importAllowOverwrite"
          label="Allow imports to overwrite existing details"
          hint="Off removes 'Overwrite' from the preview, so a spreadsheet can never replace details someone typed by hand."
          defaultChecked={settings.importAllowOverwrite}
        />
      </fieldset>

      <div className="border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import {
  addCustomFieldAction,
  reorderCustomFieldAction,
  toggleCustomFieldAction,
  updateCustomFieldAction,
} from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import {
  CUSTOM_FIELD_LIMITS,
  kindNeedsOptions,
  type CustomFieldDefinitionSummary,
} from "@/lib/leads/customFieldTypes";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

const KIND_OPTIONS = [
  { value: "TEXT", label: "Text", hint: "A short line — Industry, Region." },
  { value: "LONG_TEXT", label: "Long text", hint: "A paragraph. Kept out of narrow columns." },
  { value: "NUMBER", label: "Number", hint: "Sorts numerically — Budget, Headcount." },
  { value: "DATE", label: "Date", hint: "A calendar date — Renewal, Deadline." },
  { value: "CHECKBOX", label: "Checkbox", hint: "Yes or no — NDA signed." },
  { value: "URL", label: "Link", hint: "A http(s) address, rendered clickable." },
  { value: "SINGLE_SELECT", label: "Dropdown", hint: "One of a list you define." },
  { value: "MULTI_SELECT", label: "Multi-select", hint: "Several of a list you define." },
] as const;

const KIND_LABELS: Record<string, string> = Object.fromEntries(
  KIND_OPTIONS.map((option) => [option.value, option.label]),
);

/**
 * The admin-defined fields on a contact.
 *
 * Kind is chosen at creation and fixed thereafter: converting a text field to a number would
 * leave every stored value in the wrong column with nothing sensible to migrate it to, and the
 * honest version of that is a new field rather than a silent conversion.
 */
export function CustomFieldEditor({
  definitions,
}: {
  definitions: CustomFieldDefinitionSummary[];
}) {
  const [state, formAction] = useActionState(addCustomFieldAction, IDLE_FORM_STATE);
  const [kind, setKind] = useState<string>("TEXT");
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedKind = KIND_OPTIONS.find((option) => option.value === kind);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm text-fg">Extra fields</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          Anything else this team records about a person. Each one becomes a column on the leads
          table, a box on the contact page, and a mappable column in the importer. Retiring a field
          hides it everywhere but keeps every value, so bringing it back brings the data with it.
        </p>
      </div>

      {definitions.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {definitions.map((definition, index) => (
            <li key={definition.id} className="flex flex-col gap-2 py-2">
              <div className="flex items-center gap-3">
                <ReorderControls
                  id={definition.id}
                  isFirst={index === 0}
                  isLast={index === definitions.length - 1}
                  moveAction={reorderCustomFieldAction}
                  label={definition.label}
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${definition.isActive ? "text-fg" : "text-muted line-through"}`}
                  >
                    {definition.label}
                  </p>
                  <p className="text-[11px] text-muted">
                    {KIND_LABELS[definition.kind] ?? definition.kind}
                    {definition.options.length > 0 && ` · ${definition.options.length} options`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingId(editingId === definition.id ? null : definition.id)}
                  className="text-[11px] text-muted transition-colors duration-150 hover:text-accent"
                >
                  {editingId === definition.id ? "Close" : "Edit"}
                </button>

                <form action={toggleCustomFieldAction}>
                  <input type="hidden" name="id" value={definition.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={definition.isActive ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="text-[11px] text-muted transition-colors duration-150 hover:text-accent"
                  >
                    {definition.isActive ? "Retire" : "Restore"}
                  </button>
                </form>
              </div>

              {editingId === definition.id && (
                <EditFieldForm definition={definition} onDone={() => setEditingId(null)} />
              )}
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-col gap-3 rounded-sm border border-border p-3">
        <FormMessage status={state.status} message={state.message} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Name</span>
            <input
              type="text"
              name="label"
              maxLength={CUSTOM_FIELD_LIMITS.label}
              placeholder="Industry"
              className={CONTROL_CLASSES}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Kind</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className={CONTROL_CLASSES}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedKind && (
              <span className="text-[11px] leading-relaxed text-muted">{selectedKind.hint}</span>
            )}
          </label>
        </div>

        {kindNeedsOptions(kind as CustomFieldDefinitionSummary["kind"]) && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[0.14em] text-muted">Options</span>
            <input
              type="text"
              name="options"
              placeholder="1–10, 11–50, 51–200, 200+"
              className={CONTROL_CLASSES}
            />
            <span className="text-[11px] text-muted">
              Comma or newline separated, up to {CUSTOM_FIELD_LIMITS.optionCount}.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Hint (optional)</span>
          <input
            type="text"
            name="helpText"
            maxLength={CUSTOM_FIELD_LIMITS.helpText}
            placeholder="Shown under the box on a contact."
            className={CONTROL_CLASSES}
          />
        </label>

        <div>
          <SubmitButton pendingLabel="Adding…" variant="secondary">
            Add field
          </SubmitButton>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          The kind can&rsquo;t be changed afterwards — stored values live in a column chosen by it,
          so switching would strand them. Add a new field instead.
        </p>
      </form>
    </section>
  );
}

function EditFieldForm({
  definition,
  onDone,
}: {
  definition: CustomFieldDefinitionSummary;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(updateCustomFieldAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-sm bg-card p-3">
      <input type="hidden" name="id" value={definition.id} />

      <FormMessage status={state.status} message={state.message} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-[0.14em] text-muted">Name</span>
        <input
          type="text"
          name="label"
          defaultValue={definition.label}
          maxLength={CUSTOM_FIELD_LIMITS.label}
          className={CONTROL_CLASSES}
        />
      </label>

      {kindNeedsOptions(definition.kind) && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-[0.14em] text-muted">Options</span>
          <input
            type="text"
            name="options"
            defaultValue={definition.options.join(", ")}
            className={CONTROL_CLASSES}
          />
          <span className="text-[11px] leading-relaxed text-muted">
            Removing an option leaves it on contacts that already had it — it just stops being
            offered.
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-[0.14em] text-muted">Hint</span>
        <input
          type="text"
          name="helpText"
          defaultValue={definition.helpText ?? ""}
          maxLength={CUSTOM_FIELD_LIMITS.helpText}
          className={CONTROL_CLASSES}
        />
      </label>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

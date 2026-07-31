"use client";

import { useActionState } from "react";

import { saveCustomFieldValuesAction } from "@/app/admin/leads/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import {
  CUSTOM_FIELD_INPUT_PREFIX,
  CUSTOM_FIELD_LIMITS,
  type CustomFieldCell,
  type CustomFieldDefinitionSummary,
} from "@/lib/leads/customFieldTypes";

const CONTROL_CLASSES =
  "w-full rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none";

/**
 * The admin-defined fields on a contact.
 *
 * Every input is named `custom_<definitionId>` so the action can pair a submitted value back to
 * the definition that validates it, without the browser being trusted to say which kind it is.
 */
export function CustomFieldsForm({
  contactId,
  definitions,
  cells,
  canEdit,
}: {
  contactId: string;
  definitions: CustomFieldDefinitionSummary[];
  cells: CustomFieldCell[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(saveCustomFieldValuesAction, IDLE_FORM_STATE);

  if (definitions.length === 0) {
    return null;
  }

  // Read-only rendering for a salesperson an admin hasn't given the permission to. The action
  // checks the same setting, so this is convenience rather than the control itself.
  if (!canEdit) {
    return (
      <dl className="flex flex-col divide-y divide-border border-y border-border">
        {definitions.map((definition, index) => (
          <div key={definition.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-xs text-muted">{definition.label}</dt>
            <dd className="text-sm text-fg">
              {cells[index]?.isSet ? cells[index].display : <span className="text-muted/40">—</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="contactId" value={contactId} />

      <FormMessage status={state.status} message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        {definitions.map((definition, index) => (
          <CustomFieldInput
            key={definition.id}
            definition={definition}
            cell={cells[index]}
            error={state.fieldErrors[`${CUSTOM_FIELD_INPUT_PREFIX}${definition.id}`]}
          />
        ))}
      </div>

      <div>
        <SubmitButton pendingLabel="Saving…" variant="secondary">
          Save fields
        </SubmitButton>
      </div>
    </form>
  );
}

function CustomFieldInput({
  definition,
  cell,
  error,
}: {
  definition: CustomFieldDefinitionSummary;
  cell: CustomFieldCell | undefined;
  error: string | undefined;
}) {
  const name = `${CUSTOM_FIELD_INPUT_PREFIX}${definition.id}`;
  const value = cell?.inputValue ?? "";

  return (
    <div className={definition.kind === "LONG_TEXT" ? "flex flex-col gap-1.5 sm:col-span-2" : "flex flex-col gap-1.5"}>
      <label htmlFor={name} className="text-xs uppercase tracking-[0.14em] text-muted">
        {definition.label}
      </label>

      {renderControl(definition, name, value, cell?.selectedOptions ?? [])}

      {definition.helpText && !error && (
        <p className="text-[11px] leading-relaxed text-muted">{definition.helpText}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function renderControl(
  definition: CustomFieldDefinitionSummary,
  name: string,
  value: string,
  selectedOptions: string[],
) {
  switch (definition.kind) {
    case "LONG_TEXT":
      return (
        <textarea
          id={name}
          name={name}
          rows={3}
          defaultValue={value}
          maxLength={CUSTOM_FIELD_LIMITS.longText}
          className={`${CONTROL_CLASSES} resize-y leading-relaxed`}
        />
      );

    case "NUMBER":
      return (
        <input
          id={name}
          name={name}
          type="text"
          inputMode="decimal"
          defaultValue={value}
          placeholder="25000"
          className={CONTROL_CLASSES}
        />
      );

    case "DATE":
      return (
        <input id={name} name={name} type="date" defaultValue={value} className={CONTROL_CLASSES} />
      );

    case "CHECKBOX":
      return (
        <label className="flex items-center gap-2 py-1.5 text-sm text-fg">
          <input
            id={name}
            name={name}
            type="checkbox"
            value="true"
            defaultChecked={value === "true"}
            className="size-4 accent-accent"
          />
          Yes
        </label>
      );

    case "URL":
      return (
        <input
          id={name}
          name={name}
          type="url"
          defaultValue={value}
          placeholder="https://"
          className={CONTROL_CLASSES}
        />
      );

    case "SINGLE_SELECT":
      return (
        <select id={name} name={name} defaultValue={value} className={CONTROL_CLASSES}>
          <option value="">— none —</option>
          {definition.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "MULTI_SELECT":
      return (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {definition.options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong px-2 py-1 text-[11px] text-muted transition-colors duration-150 hover:text-fg has-checked:border-accent/50 has-checked:text-accent"
            >
              <input
                type="checkbox"
                name={name}
                value={option}
                defaultChecked={selectedOptions.includes(option)}
                className="size-3 accent-accent"
              />
              {option}
            </label>
          ))}
        </div>
      );

    default:
      return (
        <input
          id={name}
          name={name}
          type="text"
          defaultValue={value}
          maxLength={CUSTOM_FIELD_LIMITS.text}
          className={CONTROL_CLASSES}
        />
      );
  }
}

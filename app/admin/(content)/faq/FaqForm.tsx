"use client";

import { useActionState } from "react";

import { createFaqAction, updateFaqAction } from "@/app/admin/(content)/faq/actions";
import { ButtonLink } from "@/components/ui/Button";
import { FormMessage, ParagraphsField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface FaqFormValues {
  id?: string;
  question: string;
  /** Paragraphs joined with blank lines, which is how the textarea round-trips them. */
  answer: string;
}

export function FaqForm({ entry }: { entry?: FaqFormValues }) {
  const isEditing = Boolean(entry?.id);
  const [state, formAction] = useActionState(
    isEditing ? updateFaqAction : createFaqAction,
    IDLE_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {entry?.id && <input type="hidden" name="id" value={entry.id} />}

      <FormMessage status={state.status} message={state.message} />

      <TextField
        label="Question"
        name="question"
        defaultValue={entry?.question ?? ""}
        max={FIELD_LIMITS.faqQuestion}
        error={state.fieldErrors.question}
      />

      <ParagraphsField
        label="Answer"
        name="answer"
        defaultValue={entry?.answer ?? ""}
        maxParagraph={FIELD_LIMITS.faqParagraph}
        maxCount={FIELD_LIMITS.faqParagraphCount}
        error={state.fieldErrors.answer}
        hint="Leave a blank line between paragraphs — each one renders as its own line of the hologram. Long answers scroll rather than stretching it."
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel={isEditing ? "Saving…" : "Adding…"}>
          {isEditing ? "Save draft" : "Add question"}
        </SubmitButton>
        <ButtonLink href="/admin/faq" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

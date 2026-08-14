"use client";

import { useActionState } from "react";

import { updateAboutAction } from "@/app/(panel)/(content)/about/actions";
import {
  ChipListField,
  DelimitedListField,
  FormMessage,
  ParagraphsField,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import {
  CLAIM_PARTS,
  FIELD_LIMITS,
  INSTRUMENT_PARTS,
  PHASE_PARTS,
} from "@/lib/validation/contentSchemas";

export interface AboutFormValues {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  lead: string;
  /** Already joined on blank lines by the page, the same way the FAQ answer arrives. */
  premiseParagraphs: string;
  premiseQuote: string;
  principles: { claim: string; backing: string }[];
  buildPhases: { span: string; name: string; detail: string }[];
  instruments: { label: string; value: string }[];
  instrumentsNote: string;
  stack: string[];
  stackNote: string;
  closingTitle: string;
  closingLead: string;
  careersInvite: string;
}

export function AboutForm({ about }: { about: AboutFormValues }) {
  const [state, formAction] = useActionState(updateAboutAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Masthead</legend>

        <TextField
          label="Eyebrow"
          rendersAs="above the title"
          name="eyebrow"
          defaultValue={about.eyebrow}
          max={FIELD_LIMITS.documentEyebrow}
          error={state.fieldErrors.eyebrow}
          hint="Just the document's name. The navbar's wordmark sits directly above it, so repeating “Voidix” here is the brand introducing itself twice."
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Title line 1"
            name="titleLine1"
            defaultValue={about.titleLine1}
            max={FIELD_LIMITS.documentTitleLine}
            error={state.fieldErrors.titleLine1}
          />
          <TextField
            label="Title line 2"
            name="titleLine2"
            defaultValue={about.titleLine2}
            max={FIELD_LIMITS.documentTitleLine}
            error={state.fieldErrors.titleLine2}
          />
        </div>
        <p className="-mt-3 text-[11px] leading-relaxed text-muted">
          One sentence per line, as two separate fields — the masthead renders each as its own
          line, so a newline typed into one field would not land where you expect.
        </p>

        <TextAreaField
          label="Lead"
          rendersAs="paragraph"
          name="lead"
          defaultValue={about.lead}
          max={FIELD_LIMITS.documentLead}
          rows={4}
          error={state.fieldErrors.lead}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">01 · The premise</legend>

        <ParagraphsField
          label="Paragraphs"
          rendersAs="paragraphs"
          name="premiseParagraphs"
          defaultValue={about.premiseParagraphs}
          maxParagraph={FIELD_LIMITS.documentParagraph}
          maxCount={FIELD_LIMITS.documentParagraphCount}
          error={state.fieldErrors.premiseParagraphs}
          hint="Leave a blank line between paragraphs. Each becomes its own paragraph on the page."
        />

        <TextAreaField
          label="Pull quote"
          rendersAs="pull quote"
          name="premiseQuote"
          defaultValue={about.premiseQuote}
          max={FIELD_LIMITS.documentQuote}
          rows={3}
          error={state.fieldErrors.premiseQuote}
          hint="Set larger than the prose around it, so it carries the section on its own."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">02 · What we are made of</legend>

        <DelimitedListField
          label="Principles"
          rendersAs="numbered claims"
          name="principles"
          parts={CLAIM_PARTS}
          defaultValue={about.principles}
          maxCount={FIELD_LIMITS.claimCount}
          error={state.fieldErrors.principles}
          placeholder={"The hard part first. | The first fortnight goes on whatever the project is most likely to die of."}
          hint="One per line: the claim, then the thing that backs it up, separated by a pipe. Numbering is added automatically from the order."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">03 · How a build runs</legend>

        <DelimitedListField
          label="Phases"
          rendersAs="numbered phases"
          name="buildPhases"
          parts={PHASE_PARTS}
          defaultValue={about.buildPhases}
          maxCount={FIELD_LIMITS.phaseCount}
          error={state.fieldErrors.buildPhases}
          placeholder={"Week 1–2 | Prove | We build the riskiest part first."}
          hint="One per line: when it happens, what it is called, and what happens in it."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">04 · The instruments</legend>

        <DelimitedListField
          label="Instruments"
          rendersAs="label and value rows"
          name="instruments"
          parts={INSTRUMENT_PARTS}
          defaultValue={about.instruments}
          maxCount={FIELD_LIMITS.instrumentCount}
          error={state.fieldErrors.instruments}
          placeholder={"First reply | Under 5 days"}
          hint="Commitments, not a scoreboard — these are numbers the studio will be held to before a line of code exists, not a record of what it has done."
        />

        <TextField
          label="Note under the instruments"
          rendersAs="note under the rows"
          name="instrumentsNote"
          defaultValue={about.instrumentsNote}
          max={FIELD_LIMITS.documentNote}
          error={state.fieldErrors.instrumentsNote}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">05 · What we work in</legend>

        <ChipListField
          label="Stack"
          rendersAs="chips"
          name="stack"
          defaultValue={about.stack}
          maxLabel={FIELD_LIMITS.stackItem}
          maxCount={FIELD_LIMITS.stackCount}
          error={state.fieldErrors.stack}
          hint="Check this against what the studio actually sells before publishing — it is the one list on this page that could quietly become a lie by omission."
        />

        <TextField
          label="Note under the stack"
          rendersAs="note under the chips"
          name="stackNote"
          defaultValue={about.stackNote}
          max={FIELD_LIMITS.documentNote}
          error={state.fieldErrors.stackNote}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">Closing</legend>

        <TextField
          label="Closing title"
          rendersAs="closing heading"
          name="closingTitle"
          defaultValue={about.closingTitle}
          max={FIELD_LIMITS.documentClosingTitle}
          error={state.fieldErrors.closingTitle}
        />

        <TextAreaField
          label="Closing lead"
          rendersAs="paragraph"
          name="closingLead"
          defaultValue={about.closingLead}
          max={FIELD_LIMITS.documentClosingLead}
          rows={3}
          error={state.fieldErrors.closingLead}
        />

        <TextField
          label="Link to Careers"
          rendersAs="link to /careers"
          name="careersInvite"
          defaultValue={about.careersInvite}
          max={FIELD_LIMITS.documentInvite}
          error={state.fieldErrors.careersInvite}
          hint="The cross-link to the careers page. Both document pages carry one to the other."
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

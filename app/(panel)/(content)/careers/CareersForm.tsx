"use client";

import { useActionState } from "react";

import { updateCareersAction } from "@/app/(panel)/(content)/careers/actions";
import {
  ChipListField,
  DelimitedListField,
  FormMessage,
  TextAreaField,
  TextField,
} from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { CLAIM_PARTS, FIELD_LIMITS, PHASE_PARTS } from "@/lib/validation/contentSchemas";

export interface CareersFormValues {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  lead: string;
  workingHere: { claim: string; backing: string }[];
  hiringPhases: { span: string; name: string; detail: string }[];
  rolesEmptyLine: string;
  rolesEmptyInvite: string;
  openApplicationTitle: string;
  openApplicationLead: string;
  openApplicationSubject: string;
  openApplicationSeed: string;
  commitmentLabel: string;
  commitmentOptions: string[];
  applicationBriefLabel: string;
  applicationSubmitLabel: string;
  aboutInvite: string;
}

export function CareersForm({ careers }: { careers: CareersFormValues }) {
  const [state, formAction] = useActionState(updateCareersAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Masthead</legend>

        <TextField
          label="Eyebrow"
          rendersAs="above the title"
          name="eyebrow"
          defaultValue={careers.eyebrow}
          max={FIELD_LIMITS.documentEyebrow}
          error={state.fieldErrors.eyebrow}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Title line 1"
            rendersAs="display heading"
            name="titleLine1"
            defaultValue={careers.titleLine1}
            max={FIELD_LIMITS.documentTitleLine}
            error={state.fieldErrors.titleLine1}
          />
          <TextField
            label="Title line 2"
            rendersAs="display heading"
            name="titleLine2"
            defaultValue={careers.titleLine2}
            max={FIELD_LIMITS.documentTitleLine}
            error={state.fieldErrors.titleLine2}
          />
        </div>

        <TextAreaField
          label="Lead"
          rendersAs="paragraph"
          name="lead"
          defaultValue={careers.lead}
          max={FIELD_LIMITS.documentLead}
          rows={4}
          error={state.fieldErrors.lead}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">01 · What it is like here</legend>

        <DelimitedListField
          label="Claims"
          rendersAs="numbered claims"
          name="workingHere"
          parts={CLAIM_PARTS}
          defaultValue={careers.workingHere}
          maxCount={FIELD_LIMITS.claimCount}
          error={state.fieldErrors.workingHere}
          placeholder={"You own the surface. | Not a ticket queue. A thing with edges, a date, and your judgement in the middle of it."}
          hint="One per line: the claim, then the thing that backs it up. Numbering follows the order."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">02 · When no role is open</legend>

        <TextField
          label="Empty-roles line"
          rendersAs="shown when no roles"
          name="rolesEmptyLine"
          defaultValue={careers.rolesEmptyLine}
          max={FIELD_LIMITS.rolesEmptyLine}
          error={state.fieldErrors.rolesEmptyLine}
          hint="What the roles section says when the list below is empty. That is a designed state, not a broken one — so this is required copy, not something to fill in later."
        />

        <TextField
          label="Empty-roles link"
          rendersAs="shown when no roles"
          name="rolesEmptyInvite"
          defaultValue={careers.rolesEmptyInvite}
          max={FIELD_LIMITS.rolesEmptyInvite}
          error={state.fieldErrors.rolesEmptyInvite}
          hint="The link that follows it, travelling to the open application below."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">03 · How hiring runs</legend>

        <DelimitedListField
          label="Phases"
          rendersAs="numbered phases"
          name="hiringPhases"
          parts={PHASE_PARTS}
          defaultValue={careers.hiringPhases}
          maxCount={FIELD_LIMITS.phaseCount}
          error={state.fieldErrors.hiringPhases}
          placeholder={"Day 0 | You write | A note, and a link or a CV. No cover letter."}
          hint="Keep the first phase honest about what the form actually asks for — it collects a name, an email, the work as a link or a CV, and why you. Process copy promising something smaller is a promise the form breaks."
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">04 · The open application</legend>

        <TextField
          label="Title"
          rendersAs="section heading"
          name="openApplicationTitle"
          defaultValue={careers.openApplicationTitle}
          max={FIELD_LIMITS.openApplicationTitle}
          error={state.fieldErrors.openApplicationTitle}
        />

        <TextAreaField
          label="Lead"
          rendersAs="paragraph"
          name="openApplicationLead"
          defaultValue={careers.openApplicationLead}
          max={FIELD_LIMITS.openApplicationLead}
          rows={3}
          error={state.fieldErrors.openApplicationLead}
        />

        <TextField
          label="Subject"
          rendersAs="the form's subject"
          name="openApplicationSubject"
          defaultValue={careers.openApplicationSubject}
          max={FIELD_LIMITS.openApplicationSubject}
          error={state.fieldErrors.openApplicationSubject}
          hint="Carried in place of a role title when someone applies without one."
        />

        <TextField
          label="Brief seed"
          rendersAs="seeds the form"
          name="openApplicationSeed"
          defaultValue={careers.openApplicationSeed}
          max={FIELD_LIMITS.applicationSeed}
          error={state.fieldErrors.openApplicationSeed}
          hint="Seeds the long field. Write it in the applicant's voice and leave it mid-sentence, so it reads as a note they started rather than a message written for them. Don't add a trailing space — the gap before what they type is added for you."
        />

        <TextField
          label="Commitment label"
          rendersAs="label in the form"
          name="commitmentLabel"
          defaultValue={careers.commitmentLabel}
          max={FIELD_LIMITS.applicationLabel}
          error={state.fieldErrors.commitmentLabel}
          hint="Asked only on the open application — a posted role already states its own terms in the row you opened it from."
        />

        <ChipListField
          label="Commitment options"
          rendersAs="choice chips"
          name="commitmentOptions"
          defaultValue={careers.commitmentOptions}
          maxLabel={FIELD_LIMITS.commitmentOption}
          maxCount={FIELD_LIMITS.commitmentCount}
          error={state.fieldErrors.commitmentOptions}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">Application form strings</legend>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextField
            label="Long field label"
            rendersAs="label in the form"
            name="applicationBriefLabel"
            defaultValue={careers.applicationBriefLabel}
            max={FIELD_LIMITS.applicationLabel}
            error={state.fieldErrors.applicationBriefLabel}
            hint="The form asks for a brief by default; an applicant is answering a different question."
          />
          <TextField
            label="Submit button"
            rendersAs="button label"
            name="applicationSubmitLabel"
            defaultValue={careers.applicationSubmitLabel}
            max={FIELD_LIMITS.applicationSubmitLabel}
            error={state.fieldErrors.applicationSubmitLabel}
          />
        </div>

        <TextField
          label="Link to About"
          rendersAs="link to /about"
          name="aboutInvite"
          defaultValue={careers.aboutInvite}
          max={FIELD_LIMITS.documentInvite}
          error={state.fieldErrors.aboutInvite}
          hint="The cross-link to the about page. Both document pages carry one to the other."
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

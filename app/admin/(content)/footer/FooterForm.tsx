"use client";

import { useActionState } from "react";

import { updateFooterAction } from "@/app/admin/(content)/footer/actions";
import { FormMessage, LinkGroupsField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface FooterFormValues {
  tagline: string;
  signOff: string;
  linkGroups: { title: string; links: { label: string; href: string }[] }[];
}

export function FooterForm({ footer }: { footer: FooterFormValues }) {
  const [state, formAction] = useActionState(updateFooterAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FormMessage status={state.status} message={state.message} />

      <fieldset className="flex flex-col gap-6">
        <legend className="eyebrow mb-4">Links</legend>

        <LinkGroupsField
          label="Link groups"
          name="linkGroups"
          defaultValue={footer.linkGroups}
          maxGroups={FIELD_LIMITS.footerGroupCount}
          maxLinksPerGroup={FIELD_LIMITS.footerLinksPerGroup}
          error={state.fieldErrors.linkGroups}
          hint="A heading in square brackets starts a column; every line under it is Label | destination. Paths (/privacy), full URLs and mailto: addresses are all allowed. Anything starting http:// or https:// opens in a new tab — you don't set that, it follows from the destination."
        />

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          <strong className="text-fg">This one list is both footers.</strong> The homepage&rsquo;s
          contact section renders it and so do the About and Careers pages — deliberately, so a
          changed handle can&rsquo;t land in one and not the other. They have very different room
          though: the contact footer shares a single pinned screen with the form and the black
          hole. Check a longer label against a narrow phone, not just the document pages.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-border pt-8">
        <legend className="eyebrow mb-4">Sign-off</legend>

        <TextField
          label="Tagline"
          name="tagline"
          defaultValue={footer.tagline}
          max={FIELD_LIMITS.footerTagline}
          error={state.fieldErrors.tagline}
          hint="The line under the wordmark."
        />

        <TextField
          label="Sign-off line"
          name="signOff"
          defaultValue={footer.signOff}
          max={FIELD_LIMITS.footerSignOff}
          error={state.fieldErrors.signOff}
          hint="The line across the bottom. Not a copyright notice — there is no year in it, so it needs no editing each January."
        />

        <p className="-mt-2 text-[11px] leading-relaxed text-muted">
          Both of these are still written into{" "}
          <code className="text-fg">PageFooter.tsx</code> on the site, so editing them here
          changes the draft and nothing else until a developer points the footer at this data. The
          links above are already in a content file and need no such change.
        </p>
      </fieldset>

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

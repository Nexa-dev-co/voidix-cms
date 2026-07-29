"use client";

import { useActionState } from "react";

import { updateFooterAction } from "@/app/admin/(content)/footer/actions";
import { FormMessage, LinkListField, TextField } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

export interface FooterFormValues {
  tagline: string;
  copyright: string;
  socialLinks: { label: string; url: string }[];
  legalLinks: { label: string; url: string }[];
}

export function FooterForm({ footer }: { footer: FooterFormValues }) {
  const [state, formAction] = useActionState(updateFooterAction, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormMessage status={state.status} message={state.message} />

      <TextField
        label="Tagline"
        name="tagline"
        defaultValue={footer.tagline}
        max={FIELD_LIMITS.footerTagline}
        error={state.fieldErrors.tagline}
      />

      <TextField
        label="Copyright"
        name="copyright"
        defaultValue={footer.copyright}
        max={FIELD_LIMITS.footerCopyright}
        error={state.fieldErrors.copyright}
        hint="Written out in full — the year does not update itself, so it needs editing each January."
      />

      <LinkListField
        label="Social links"
        name="socialLinks"
        defaultValue={footer.socialLinks}
        maxCount={FIELD_LIMITS.footerSocialCount}
        error={state.fieldErrors.socialLinks}
        hint="One per line, as Label | URL. Leave empty for none."
      />

      <LinkListField
        label="Legal links"
        name="legalLinks"
        defaultValue={footer.legalLinks}
        maxCount={FIELD_LIMITS.footerLegalCount}
        error={state.fieldErrors.legalLinks}
        hint="Privacy, terms and the like. Root-relative paths such as /privacy are fine."
      />

      <div className="flex items-center gap-3 border-t border-border pt-6">
        <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
      </div>
    </form>
  );
}

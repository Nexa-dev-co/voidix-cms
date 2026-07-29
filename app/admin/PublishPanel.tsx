"use client";

import { useActionState } from "react";

import { publishAction } from "@/app/admin/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";
import type { DraftStatus } from "@/lib/content/contentPayload";

const SECTION_LABELS: Record<keyof DraftStatus["changedSections"], string> = {
  services: "Services",
  projects: "Works",
  faq: "FAQ",
  contact: "Contact",
  footer: "Footer",
};

export function PublishPanel({ draftStatus }: { draftStatus: DraftStatus }) {
  const [state, formAction] = useActionState(publishAction, IDLE_FORM_STATE);

  const changedSections = (
    Object.keys(SECTION_LABELS) as (keyof DraftStatus["changedSections"])[]
  ).filter((section) => draftStatus.changedSections[section]);

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              draftStatus.hasUnpublishedChanges ? "bg-warning" : "bg-success"
            }`}
          />
          <h2 className="font-display text-base font-bold">
            {draftStatus.hasUnpublishedChanges ? "Unpublished changes" : "Everything is published"}
          </h2>
        </div>

        {changedSections.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {changedSections.map((section) => (
              <span
                key={section}
                className="rounded-sm border border-warning/30 px-2 py-0.5 text-[11px] text-warning"
              >
                {SECTION_LABELS[section]}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mb-5 text-sm leading-relaxed text-muted">
        {draftStatus.neverPublished
          ? "Nothing has been published yet. The first release snapshots everything currently in the editor."
          : draftStatus.hasUnpublishedChanges
            ? "Your edits are saved here but the site is still serving the last release. Publishing takes a snapshot and asks the site to rebuild."
            : "The draft matches the last release. There is nothing waiting to go out."}
      </p>

      <form action={formAction} className="flex flex-col gap-3">
        <FormMessage status={state.status} message={state.message} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="note"
            maxLength={FIELD_LIMITS.releaseNote}
            placeholder="What changed? (optional)"
            className="min-w-0 flex-1 rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
          />
          <SubmitButton pendingLabel="Publishing…" variant="primary">
            Publish
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

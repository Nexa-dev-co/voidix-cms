"use client";

import { useActionState } from "react";

import { publishAction } from "@/app/(panel)/actions";
import { FormMessage } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { DraftStatus } from "@/lib/content/contentPayload";
import type { SelectableBlogChange } from "@/lib/content/publishSelection";
import { IDLE_FORM_STATE } from "@/lib/forms/formState";
import { FIELD_LIMITS } from "@/lib/validation/contentSchemas";

// Ordered as the sidebar orders them, so the choices read in the same sequence as the nav.
const SECTION_LABELS: Record<keyof DraftStatus["changedSections"], string> = {
  services: "Services",
  projects: "Works",
  faq: "FAQ",
  contact: "Contact",
  footer: "Footer",
  about: "About",
  careers: "Careers",
  blogs: "Blog",
  enquiryForm: "Enquiry form",
};

const SECTION_KEYS = Object.keys(SECTION_LABELS) as (keyof DraftStatus["changedSections"])[];

export function PublishPanel({
  draftStatus,
  blogChanges,
}: {
  draftStatus: DraftStatus;
  blogChanges: SelectableBlogChange[];
}) {
  const [state, formAction] = useActionState(publishAction, IDLE_FORM_STATE);

  const changedSections = SECTION_KEYS.filter((section) => draftStatus.changedSections[section]);

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
          ? "Nothing has been published yet. Choose the sections or individual articles you want to put live first."
          : draftStatus.hasUnpublishedChanges
            ? "Choose only what is ready. Anything left unchecked stays exactly as it was in the last release."
            : "The draft matches the last release. There is nothing waiting to go out."}
      </p>

      {draftStatus.hasUnpublishedChanges && (
        <form action={formAction} className="flex flex-col gap-5">
          <FormMessage status={state.status} message={state.message} />

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
              Publish whole sections
            </legend>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SECTION_KEYS.map((section) => {
                const hasChanges = draftStatus.changedSections[section];

                return (
                  <label
                    key={section}
                    className={`flex items-start gap-2.5 rounded-sm border px-3 py-2.5 transition-colors ${
                      hasChanges
                        ? "cursor-pointer border-warning/40 bg-warning/5 hover:border-warning/70"
                        : "cursor-not-allowed border-border bg-field/20 opacity-45"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="sections"
                      value={section}
                      disabled={!hasChanges}
                      className="mt-0.5 size-3.5 accent-accent disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0 flex-1 text-sm text-fg">
                      <span className="flex items-baseline justify-between gap-2">
                        <span>{SECTION_LABELS[section]}</span>
                        <span
                          className={`shrink-0 text-[9px] uppercase tracking-[0.12em] ${
                            hasChanges ? "text-warning" : "text-muted"
                          }`}
                        >
                          {hasChanges ? "Draft" : "Published"}
                        </span>
                      </span>
                      {section === "footer" && hasChanges && (
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                          Includes the Journal link.
                        </span>
                      )}
                      {section === "blogs" && hasChanges && (
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                          Applies article order and deletions too.
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {blogChanges.length > 0 && (
            <fieldset className="flex flex-col gap-2.5 border-t border-border pt-4">
              <legend className="px-2 text-xs uppercase tracking-[0.14em] text-muted">
                Publish individual blog articles
              </legend>
              <p className="text-[11px] leading-relaxed text-muted">
                Selected articles update in place. Other live articles, their order, and deletions
                stay untouched.
              </p>

              <div className="max-h-64 overflow-y-auto rounded-sm border border-border bg-field/30">
                {blogChanges.map((article) => (
                  <label
                    key={article.slug}
                    className="flex cursor-pointer items-start gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-card"
                  >
                    <input
                      type="checkbox"
                      name="blogSlugs"
                      value={article.slug}
                      className="mt-0.5 size-3.5 shrink-0 accent-accent"
                    />
                    <span className="min-w-0 flex-1 text-sm text-fg">{article.title}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted">
                      {article.state}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <input
              type="text"
              name="note"
              maxLength={FIELD_LIMITS.releaseNote}
              placeholder="What changed? (optional)"
              className="min-w-0 flex-1 rounded-sm border border-border bg-field px-3 py-2 text-sm text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <SubmitButton pendingLabel="Publishing…" variant="primary">
                Publish selected
              </SubmitButton>
              <SubmitButton
                pendingLabel="Publishing…"
                variant="secondary"
                name="publishAll"
                value="true"
              >
                Publish all changes
              </SubmitButton>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

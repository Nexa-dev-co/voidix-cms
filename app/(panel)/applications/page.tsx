import Link from "next/link";

import {
  deleteApplicationAction,
  markApplicationReviewedAction,
  markApplicationUnreviewedAction,
} from "@/app/(panel)/applications/actions";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "new", label: "Unread" },
  { key: "reviewed", label: "Read" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function parseTab(raw: string | undefined): TabKey {
  return TABS.some((tab) => tab.key === raw) ? (raw as TabKey) : "new";
}

const whereForTab = (tab: TabKey) =>
  tab === "reviewed" ? { reviewedAt: { not: null } } : { reviewedAt: null };

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  // Admin-only. Sales never see this page — a candidate is not a prospect, and a CV is not
  // pipeline material.
  await requireAdmin();

  const searchParams = await props.searchParams;
  const tab = parseTab(typeof searchParams.tab === "string" ? searchParams.tab : undefined);

  const [applications, newCount, reviewedCount] = await Promise.all([
    prisma.careerApplication.findMany({
      where: whereForTab(tab),
      orderBy: { createdAt: "desc" },
      include: {
        role: { select: { id: true } },
        reviewedBy: { select: { name: true } },
      },
    }),
    prisma.careerApplication.count({ where: whereForTab("new") }),
    prisma.careerApplication.count({ where: whereForTab("reviewed") }),
  ]);

  const tabCounts: Record<TabKey, number> = { new: newCount, reviewed: reviewedCount };

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Operations"
        title="Applications"
        description="People applying through the careers page. Never leads, never published, never in the pipeline."
      />

      {newCount === 0 && tab === "new" && (
        <PageHeaderNote>
          Nothing unread. Applications arrive from{" "}
          <code className="text-fg">POST /api/applications</code>. The CV is uploaded by the site
          to UploadThing and reaches this panel as a link, so deleting an application removes our
          link to the file, not the file itself.
        </PageHeaderNote>
      )}

      <nav className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((entry) => {
          const isActive = entry.key === tab;

          return (
            <Link
              key={entry.key}
              href={`/applications?tab=${entry.key}`}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-150 ${
                isActive ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {entry.label}
              <span className="ml-2 text-[11px] tabular-nums text-muted/60">
                {tabCounts[entry.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {applications.map((application) => (
          <article key={application.id} className="flex flex-col gap-3 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-sm text-fg">{application.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {application.email}
                  {application.phone ? ` · ${application.phone}` : ""}
                </p>
              </div>
              <time
                dateTime={application.createdAt.toISOString()}
                className="shrink-0 text-[11px] tabular-nums text-muted/60"
              >
                {application.createdAt.toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>

            <p className="text-xs">
              {/* The snapshot, not the relation — a closed role is a deleted role, and the
                  application still has to say what it was for. */}
              <span className="text-accent">{application.roleTitle}</span>
              {application.commitment ? (
                <span className="text-muted"> · looking for {application.commitment}</span>
              ) : null}
              {!application.role && application.roleId === null && (
                <span className="text-muted/60"> · that posting is closed</span>
              )}
            </p>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {application.whyYou}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {application.workLink && (
                <a
                  href={application.workLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent hover:underline"
                >
                  Their work ↗
                </a>
              )}
              {application.cvUrl && (
                <a
                  href={application.cvUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent hover:underline"
                >
                  CV ↗
                </a>
              )}
            </div>

            {application.reviewedAt && (
              <p className="text-[11px] text-success">
                Read{application.reviewedBy ? ` by ${application.reviewedBy.name}` : ""} on{" "}
                {application.reviewedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {application.reviewedAt ? (
                <form action={markApplicationUnreviewedAction}>
                  <input type="hidden" name="id" value={application.id} />
                  <Button type="submit" variant="ghost" className="text-xs">
                    Mark unread
                  </Button>
                </form>
              ) : (
                <form action={markApplicationReviewedAction}>
                  <input type="hidden" name="id" value={application.id} />
                  <Button type="submit" variant="secondary" className="text-xs">
                    Mark read
                  </Button>
                </form>
              )}

              <form action={deleteApplicationAction} className="ml-auto">
                <input type="hidden" name="id" value={application.id} />
                <ConfirmSubmitButton
                  confirmMessage={`Delete ${application.name}'s application? This removes their details here. The CV file stays in UploadThing until it is removed there.`}
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </article>
        ))}
      </div>

      {applications.length === 0 && <p className="py-8 text-sm text-muted">Nothing here.</p>}
    </ReadingColumn>
  );
}

import Link from "next/link";

import {
  deleteSubmissionAction,
  dismissSubmissionAction,
  promoteSubmissionAction,
  restoreSubmissionAction,
} from "@/app/(panel)/inbox/actions";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { Button } from "@/components/ui/Button";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "promoted", label: "Added" },
  { key: "dismissed", label: "Dismissed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function parseTab(raw: string | undefined): TabKey {
  return TABS.some((tab) => tab.key === raw) ? (raw as TabKey) : "pending";
}

function whereForTab(tab: TabKey) {
  switch (tab) {
    case "promoted":
      return { promotedAt: { not: null } };
    case "dismissed":
      return { promotedAt: null, dismissedAt: { not: null } };
    case "pending":
      return { promotedAt: null, dismissedAt: null };
  }
}

export default async function InboxPage(props: PageProps<"/inbox">) {
  // Admin-only, and no layout above this one enforces it — /inbox sits outside the
  // (content) group, so the guard is here and repeated in every action.
  await requireAdmin();

  const searchParams = await props.searchParams;
  const tab = parseTab(typeof searchParams.tab === "string" ? searchParams.tab : undefined);

  const [submissions, pendingCount, promotedCount, dismissedCount] = await Promise.all([
    prisma.submission.findMany({
      where: whereForTab(tab),
      orderBy: { createdAt: "desc" },
      include: { promotedContact: { select: { id: true, name: true } } },
    }),
    prisma.submission.count({ where: whereForTab("pending") }),
    prisma.submission.count({ where: whereForTab("promoted") }),
    prisma.submission.count({ where: whereForTab("dismissed") }),
  ]);

  const tabCounts: Record<TabKey, number> = {
    pending: pendingCount,
    promoted: promotedCount,
    dismissed: dismissedCount,
  };

  // One query for the page rather than one per row. Which of these strangers the team already
  // deals with is the single most useful thing on this screen, because it changes what the
  // button does. Both sides store the address lowercased, so they match without normalising.
  const knownContacts = await prisma.contact.findMany({
    where: { email: { in: submissions.map((submission) => submission.email) } },
    select: { id: true, email: true, name: true },
  });

  const knownByEmail = new Map(knownContacts.map((contact) => [contact.email, contact]));

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Operations"
        title="Inbox"
        description="What the website's enquiry form sent. Nothing here is a lead until you add it."
      />

      {pendingCount === 0 && tab === "pending" && (
        <PageHeaderNote>
          Nothing waiting. Submissions arrive from{" "}
          <code className="text-fg">POST /api/submissions</code> and stay out of Leads, the counts
          and the reports until somebody adds them — so a bot that gets past the honeypot costs
          you one click, not a polluted pipeline.
        </PageHeaderNote>
      )}

      <nav className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((entry) => {
          const isActive = entry.key === tab;

          return (
            <Link
              key={entry.key}
              href={`/inbox?tab=${entry.key}`}
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
        {submissions.map((submission) => {
          const known = knownByEmail.get(submission.email);

          return (
            <article key={submission.id} className="flex flex-col gap-3 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  {/* ⚠ The site's form requires only an email, so a nameless submission is an
                      ordinary arrival rather than a broken one. Saying so beats printing the
                      address twice or leaving the line blank — and it is deliberately NOT the
                      guess `promoteSubmission` makes, because the inbox's job is to show what
                      actually arrived. */}
                  <p className="text-sm text-fg">
                    {submission.name ?? <span className="text-muted italic">No name given</span>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {submission.email}
                    {submission.company ? ` · ${submission.company}` : ""}
                    {submission.phone ? ` · ${submission.phone}` : ""}
                  </p>
                </div>
                <time
                  dateTime={submission.createdAt.toISOString()}
                  className="shrink-0 text-[11px] tabular-nums text-muted/60"
                >
                  {submission.createdAt.toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>

              {/* Whether we already know them changes what "add" means, so it is said before the
                  button rather than discovered after pressing it. */}
              {known && !submission.promotedAt && (
                <p className="text-[11px] text-warning">
                  Already a lead —{" "}
                  <Link href={`/leads/${known.id}`} className="underline">
                    {known.name}
                  </Link>
                  . Adding this files it on their record instead of creating a second one.
                </p>
              )}

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {submission.message ?? (
                  <span className="italic text-muted/60">
                    No message — they left an address and pressed send.
                  </span>
                )}
              </p>

              {submission.source && (
                <p className="text-[11px] text-muted/60">Sent from: {submission.source}</p>
              )}

              {submission.promotedAt && submission.promotedContact && (
                <p className="text-[11px] text-success">
                  Added to leads as{" "}
                  <Link href={`/leads/${submission.promotedContact.id}`} className="underline">
                    {submission.promotedContact.name}
                  </Link>
                  .
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {!submission.promotedAt && (
                  <form action={promoteSubmissionAction}>
                    <input type="hidden" name="id" value={submission.id} />
                    <Button type="submit" variant="primary" className="text-xs">
                      {known ? "Add to their record" : "Add to leads"}
                    </Button>
                  </form>
                )}

                {!submission.promotedAt && !submission.dismissedAt && (
                  <form action={dismissSubmissionAction}>
                    <input type="hidden" name="id" value={submission.id} />
                    <Button type="submit" variant="ghost" className="text-xs">
                      Dismiss
                    </Button>
                  </form>
                )}

                {submission.dismissedAt && !submission.promotedAt && (
                  <form action={restoreSubmissionAction}>
                    <input type="hidden" name="id" value={submission.id} />
                    <Button type="submit" variant="ghost" className="text-xs">
                      Put back
                    </Button>
                  </form>
                )}

                <form action={deleteSubmissionAction} className="ml-auto">
                  <input type="hidden" name="id" value={submission.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Delete this submission from ${submission.name ?? submission.email}? This can't be undone.`}
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </div>

      {submissions.length === 0 && <p className="py-8 text-sm text-muted">Nothing here.</p>}
    </ReadingColumn>
  );
}

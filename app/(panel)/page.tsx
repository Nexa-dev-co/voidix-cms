import Link from "next/link";

import { PublishPanel } from "@/app/(panel)/PublishPanel";
import { StageKind } from "@/generated/prisma/enums";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { buildContentPayload, compareWithRelease } from "@/lib/content/contentPayload";
import { getLatestReleasePayload } from "@/lib/content/publish";
import { prisma } from "@/lib/prisma";

// Always read live — a cached dashboard would tell an editor they have nothing to publish
// straight after they changed something.
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/services",
    label: "Services",
    note: "Edit only — adding a vessel is a dev task.",
  },
  { href: "/works", label: "Works", note: "Add, edit, reorder, remove." },
  { href: "/faq", label: "FAQ", note: "Add, edit, reorder, remove." },
  { href: "/contact", label: "Contact", note: "Section copy and every form string." },
  { href: "/footer", label: "Footer", note: "Tagline, copyright and link lists." },
  { href: "/about", label: "About", note: "The whole /about document." },
  { href: "/careers", label: "Careers", note: "Open roles, and the copy around them." },
  {
    href: "/enquiry-form",
    label: "Enquiry form",
    note: "One form, six sections. Labels, messages, subjects.",
  },
] as const;

export default async function AdminDashboardPage() {
  const member = await requireMember();
  const isAdmin = member.role === "ADMIN";

  // "Open" and "overdue" replaced the old unread count. An inbox asks what you haven't looked at;
  // a pipeline asks what is still live and what you have let slip.
  const openStageFilter = { isArchived: false, stage: { kind: StageKind.OPEN } };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [myOpenCount, myOverdueCount, teamOpenCount] = await Promise.all([
    prisma.contact.count({ where: { ...openStageFilter, assignedToId: member.id } }),
    prisma.contact.count({
      where: {
        ...openStageFilter,
        assignedToId: member.id,
        nextFollowUpAt: { lt: startOfToday },
      },
    }),
    prisma.contact.count({ where: openStageFilter }),
  ]);

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow={`Signed in as ${member.role === "ADMIN" ? "admin" : "sales"}`}
        title={`Hello, ${member.name.split(" ")[0]}`}
        description={
          isAdmin
            ? "Site copy and the lead pipeline. Copy edits are saved as a draft; the site keeps serving the last release until you publish."
            : "Your lead pipeline."
        }
      />

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="eyebrow mb-3">Leads</h2>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            <Link
              href="/leads?due=overdue&owner=mine"
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div>
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {myOverdueCount === 0
                    ? "Nothing overdue"
                    : `${myOverdueCount} overdue follow-up${myOverdueCount === 1 ? "" : "s"}`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Yours, with a follow-up date that has passed.
                </p>
              </div>
              {myOverdueCount > 0 && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger" />
              )}
            </Link>

            <Link
              href="/leads?stage=open&owner=mine"
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div>
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {myOpenCount === 0 ? "No open leads assigned to you" : `${myOpenCount} open, yours`}
                </p>
                <p className="mt-0.5 text-xs text-muted">Still live — not won, lost or archived.</p>
              </div>
            </Link>

            <Link
              href="/leads?stage=open&owner=everyone"
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div>
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {teamOpenCount === 0 ? "No open leads at all" : `${teamOpenCount} open in total`}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Across the whole team, including unassigned.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {isAdmin && <AdminSections />}
      </div>
    </ReadingColumn>
  );
}

/**
 * The publish panel and the copy sections. Split into its own component so the dashboard
 * doesn't run the content queries at all for a salesperson who will never see the result.
 */
async function AdminSections() {
  const [draftPayload, releasePayload, counts, latestRelease] = await Promise.all([
    buildContentPayload(),
    getLatestReleasePayload(),
    Promise.all([
      prisma.service.count(),
      prisma.project.count(),
      prisma.faqEntry.count(),
      prisma.careerRole.count(),
      prisma.submission.count({ where: { promotedAt: null, dismissedAt: null } }),
      prisma.careerApplication.count({ where: { reviewedAt: null } }),
    ]),
    prisma.contentRelease.findFirst({
      orderBy: { version: "desc" },
      select: { version: true, publishedAt: true, publishedBy: true },
    }),
  ]);

  const draftStatus = compareWithRelease(draftPayload, releasePayload);
  const [serviceCount, projectCount, faqCount, roleCount, waitingCount, unreadApplicationCount] =
    counts;

  // Contact, Footer and About are single records, so a row count would only ever read "1" and
  // tells an editor nothing. They show a saved/not-saved state instead. Careers has both, and
  // the countable half is the one worth surfacing — "0 roles" on a saved page is a real state,
  // not a missing one.
  const sectionCounts: Record<string, string> = {
    "/services": String(serviceCount),
    "/works": String(projectCount),
    "/faq": String(faqCount),
    "/contact": draftPayload.contact ? "saved" : "not set up",
    "/footer": draftPayload.footer ? "saved" : "not set up",
    "/about": draftPayload.about ? "saved" : "not set up",
    "/careers": draftPayload.careers ? String(roleCount) : "not set up",
    "/enquiry-form": draftPayload.enquiryForm ? "saved" : "not set up",
  };

  return (
    <>
      {/* Above the copy sections on purpose: unvetted things that arrived are work waiting on
          somebody, where site copy is work you go looking for. Both rows are hidden when there
          is nothing in them — an inbox that always says "0" stops being read. */}
      {(waitingCount > 0 || unreadApplicationCount > 0) && (
        <section>
          <h2 className="eyebrow mb-3">Waiting for you</h2>
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {waitingCount > 0 && (
              <Link
                href="/inbox"
                className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
              >
                <div>
                  <p className="text-sm text-fg transition-colors group-hover:text-accent">
                    {waitingCount} website submission{waitingCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Not leads yet — nothing enters the pipeline until you add it.
                  </p>
                </div>
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
              </Link>
            )}

            {unreadApplicationCount > 0 && (
              <Link
                href="/applications"
                className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
              >
                <div>
                  <p className="text-sm text-fg transition-colors group-hover:text-accent">
                    {unreadApplicationCount} unread application
                    {unreadApplicationCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    People applying through the careers page.
                  </p>
                </div>
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
              </Link>
            )}
          </div>
        </section>
      )}

      <PublishPanel draftStatus={draftStatus} />

      <section>
        <h2 className="eyebrow mb-3">Site copy</h2>
        <div className="flex flex-col divide-y divide-border border-y border-border">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div className="min-w-0">
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {section.label}
                </p>
                <p className="mt-0.5 text-xs text-muted">{section.note}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {sectionCounts[section.href]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-3">Last release</h2>
        {latestRelease ? (
          <p className="text-sm text-muted">
            <span className="text-fg">v{latestRelease.version}</span>
            {" · "}
            {latestRelease.publishedAt.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {latestRelease.publishedBy ? ` · ${latestRelease.publishedBy}` : ""}
            {" · "}
            <Link href="/releases" className="text-accent hover:underline">
              history
            </Link>
          </p>
        ) : (
          <p className="text-sm text-muted">Nothing published yet.</p>
        )}
      </section>
    </>
  );
}

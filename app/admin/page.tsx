import Link from "next/link";

import { PublishPanel } from "@/app/admin/PublishPanel";
import { LeadStatus } from "@/generated/prisma/enums";
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
    href: "/admin/services",
    label: "Services",
    note: "Edit only — adding a vessel is a dev task.",
  },
  { href: "/admin/works", label: "Works", note: "Add, edit, reorder, remove." },
  { href: "/admin/faq", label: "FAQ", note: "Add, edit, reorder, remove." },
  { href: "/admin/contact", label: "Contact", note: "Section copy and every form string." },
  { href: "/admin/footer", label: "Footer", note: "Tagline, copyright and link lists." },
] as const;

export default async function AdminDashboardPage() {
  const member = await requireMember();
  const isAdmin = member.role === "ADMIN";

  const [newLeadCount, myLeadCount] = await Promise.all([
    prisma.contact.count({ where: { status: LeadStatus.NEW } }),
    prisma.contact.count({ where: { assignedToId: member.id, status: LeadStatus.NEW } }),
  ]);

  return (
    <>
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
              href="/admin/leads?status=new&owner=mine"
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div>
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {myLeadCount === 0 ? "Nothing new assigned to you" : `${myLeadCount} new, yours`}
                </p>
                <p className="mt-0.5 text-xs text-muted">Assigned to you and not yet worked.</p>
              </div>
              {myLeadCount > 0 && (
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
              )}
            </Link>

            <Link
              href="/admin/leads?status=new&owner=everyone"
              className="group flex items-center justify-between gap-4 py-4 transition-colors duration-150 hover:bg-card/50"
            >
              <div>
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {newLeadCount === 0 ? "No new leads at all" : `${newLeadCount} new in total`}
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
    </>
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
    Promise.all([prisma.service.count(), prisma.project.count(), prisma.faqEntry.count()]),
    prisma.contentRelease.findFirst({
      orderBy: { version: "desc" },
      select: { version: true, publishedAt: true, publishedBy: true },
    }),
  ]);

  const draftStatus = compareWithRelease(draftPayload, releasePayload);
  const [serviceCount, projectCount, faqCount] = counts;

  // Contact and Footer are single records, so a row count would only ever read "1" and tells
  // an editor nothing. They show a saved/not-saved state instead.
  const sectionCounts: Record<string, string> = {
    "/admin/services": String(serviceCount),
    "/admin/works": String(projectCount),
    "/admin/faq": String(faqCount),
    "/admin/contact": draftPayload.contact ? "saved" : "not set up",
    "/admin/footer": draftPayload.footer ? "saved" : "not set up",
  };

  return (
    <>
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
            <Link href="/admin/releases" className="text-accent hover:underline">
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

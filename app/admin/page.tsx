import Link from "next/link";

import { PublishPanel } from "@/app/admin/PublishPanel";
import { PageHeader } from "@/components/ui/PageHeader";
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
] as const;

export default async function AdminDashboardPage() {
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

  const sectionCounts: Record<string, number> = {
    "/admin/services": serviceCount,
    "/admin/works": projectCount,
    "/admin/faq": faqCount,
  };

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Site copy"
        description="Every text field the voidix site renders. Edits are saved as a draft; the site keeps serving the last release until you publish."
      />

      <div className="flex flex-col gap-8">
        <PublishPanel draftStatus={draftStatus} />

        <section>
          <h2 className="eyebrow mb-3">Sections</h2>
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
      </div>
    </>
  );
}

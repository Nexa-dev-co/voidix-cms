import { PageHeader } from "@/components/ui/PageHeader";
import { parseReleasePayload } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const REVALIDATE_LABELS: Record<string, { label: string; className: string }> = {
  ok: { label: "site rebuilt", className: "text-success" },
  skipped: { label: "site not wired up", className: "text-muted" },
  failed: { label: "site unreachable", className: "text-danger" },
};

export default async function ReleasesPage() {
  const releases = await prisma.contentRelease.findMany({
    orderBy: { version: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        eyebrow="Section 04"
        title="Releases"
        description="Every publish, newest first. Each one is a full snapshot of the copy at that moment, so this doubles as the record of what the site was serving and when."
      />

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {releases.map((release) => {
          const payload = parseReleasePayload(release.payload);
          const status = REVALIDATE_LABELS[release.revalidateStatus ?? "skipped"];

          return (
            <article key={release.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-5">
              <span className="w-10 shrink-0 pt-0.5 font-display text-sm font-bold text-accent">
                v{release.version}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg">
                  {release.note ?? <span className="text-muted">No note</span>}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {release.publishedAt.toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  {release.publishedBy ? ` · ${release.publishedBy}` : ""}
                  {" · "}
                  <span className={status.className}>{status.label}</span>
                </p>
                {payload && (
                  <p className="mt-1.5 text-[11px] text-muted/60">
                    {payload.services.length} services · {payload.projects.length} projects ·{" "}
                    {payload.faq.length} questions
                    {payload.contact ? " · contact" : ""}
                    {payload.footer ? " · footer" : ""}
                  </p>
                )}
                {release.revalidateDetail && release.revalidateStatus === "failed" && (
                  <p className="mt-1.5 text-[11px] text-danger">{release.revalidateDetail}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {releases.length === 0 && (
        <p className="py-8 text-sm text-muted">
          Nothing published yet. Publish from the overview to create the first release.
        </p>
      )}
    </>
  );
}

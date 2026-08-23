import Link from "next/link";

import { moveProjectAction } from "@/app/(panel)/(content)/works/actions";
import MarkPreviewDialog from "@/app/(panel)/(content)/works/MarkPreviewDialog";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * How many projects the site's camera path can compose distinctly.
 *
 * Advisory, not a limit — publishing more works, it just stops being interesting. The site derives
 * the same ceiling from the same geometry; this number is repeated here rather than shared because
 * it is a judgement about how the section reads, not a contract either side can break.
 */
const COMFORTABLE_PROJECT_COUNT = 6;

export default async function WorksPage() {
  const projects = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
    include: { tags: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Section 02"
        title="Works"
        description="The projects in the field. Add, reorder and remove freely — the counter, the ordinals, the camera path and the heading all follow the list."
        action={
          <ButtonLink href="/works/new" variant="secondary">
            Add project
          </ButtonLink>
        }
      />

      {projects.length > COMFORTABLE_PROJECT_COUNT && (
        <PageHeaderNote>
          {projects.length} projects. Every one gets its own shot on the camera path, and those
          shots have to stay within about 35&deg; of face-on or the mark is seen edge-on and reads
          as a bar. Past {COMFORTABLE_PROJECT_COUNT} there is not enough of that arc left to give
          each project a distinct composition, so the later ones start to look alike. Nothing
          breaks &mdash; it just stops being worth the scroll.
        </PageHeaderNote>
      )}

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {projects.map((project, position) => (
          <div key={project.id} className="flex items-start gap-3 py-5">
            <span className="shrink-0 pt-1 text-xs tabular-nums text-muted/60">
              {formatOrdinal(position)}
            </span>

            <Link href={`/works/${project.id}`} className="group min-w-0 flex-1">
              <p className="text-sm text-fg transition-colors group-hover:text-accent">
                {project.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {project.client} · {project.year}
                {/* Not a warning — an initial is a designed state. But it is worth being able to
                    see which projects are in it without opening each one. */}
                {!project.markSvgUrl && (
                  <span className="text-muted/50"> · no mark, grows its initial</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted"
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            </Link>

            {/* Every project can be previewed, including the ones with no mark: what the site grows
                for those is the initial, and being able to see it is the point of showing it. */}
            <MarkPreviewDialog
              subject={
                project.markSvgUrl
                  ? { kind: "project", projectId: project.id }
                  : { kind: "initial" }
              }
              projectTitle={project.title}
              triggerVariant="ghost"
            />

            <ReorderControls
              id={project.id}
              isFirst={position === 0}
              isLast={position === projects.length - 1}
              moveAction={moveProjectAction}
              label={project.title}
            />
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <p className="py-8 text-sm text-muted">
          No projects yet. Add one, or run <code className="text-fg">npm run db:seed</code> to
          load the current site copy.
        </p>
      )}
    </>
  );
}

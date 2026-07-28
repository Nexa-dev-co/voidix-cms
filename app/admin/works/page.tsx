import Link from "next/link";

import { moveProjectAction } from "@/app/admin/works/actions";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
        description="The projects in the field. Add, reorder and remove freely — the counter and the ordinals follow the list."
        action={
          <ButtonLink href="/admin/works/new" variant="secondary">
            Add project
          </ButtonLink>
        }
      />

      {projects.length !== 4 && (
        <PageHeaderNote>
          The Works heading on the site reads <strong className="text-fg">&ldquo;Four fires.&rdquo;</strong>{" "}
          and is hardcoded in <code className="text-fg">WorksField.tsx</code>. With{" "}
          {projects.length} project{projects.length === 1 ? "" : "s"} that heading is now wrong —
          it needs a developer to change it.
        </PageHeaderNote>
      )}

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {projects.map((project, position) => (
          <div key={project.id} className="flex items-start gap-3 py-5">
            <span className="shrink-0 pt-1 text-xs tabular-nums text-muted/60">
              {formatOrdinal(position)}
            </span>

            <Link href={`/admin/works/${project.id}`} className="group min-w-0 flex-1">
              <p className="text-sm text-fg transition-colors group-hover:text-accent">
                {project.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {project.client} · {project.year}
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

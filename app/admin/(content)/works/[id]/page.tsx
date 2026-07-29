import { notFound } from "next/navigation";

import { deleteProjectAction } from "@/app/admin/(content)/works/actions";
import { ProjectForm } from "@/app/admin/(content)/works/ProjectForm";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditProjectPage(props: PageProps<"/admin/works/[id]">) {
  const { id } = await props.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { tags: { orderBy: { sortOrder: "asc" } } },
  });

  if (!project) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow={`Project ${formatOrdinal(project.sortOrder)}`}
        title={project.title}
        description="Copy only. The rock this project is carved into stays in the site's source."
      />

      <ProjectForm
        project={{
          id: project.id,
          title: project.title,
          client: project.client,
          year: project.year,
          description: project.description,
          tags: project.tags.map((tag) => tag.label),
        }}
      />

      <DangerZone
        id={project.id}
        deleteAction={deleteProjectAction}
        title="Delete this project"
        description="Removes it from the draft along with its tags, and renumbers the rest. The last published release keeps its own copy until you publish again."
        confirmMessage={`Delete "${project.title}"? This can't be undone.`}
        buttonLabel="Delete project"
      />
    </>
  );
}

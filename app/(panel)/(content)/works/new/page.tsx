import { ProjectForm } from "@/app/(panel)/(content)/works/ProjectForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const disciplines = await prisma.discipline.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        eyebrow="Works"
        title="Add a project"
        description="Text only. The project appears in the field as soon as you publish."
      />

      <PageHeaderNote>
        Every project is a rock the camera flies to, and rock geometry lives in the site&rsquo;s
        source. A project added here renders with the global fallback rock, so several
        text-only additions will read as the same body repeated. Giving this one its own
        silhouette is a developer task.
      </PageHeaderNote>

      <ProjectForm disciplines={disciplines} />
    </>
  );
}

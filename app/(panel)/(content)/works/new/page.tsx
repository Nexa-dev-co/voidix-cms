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
        description="The project appears in the field as soon as you publish."
      />

      <PageHeaderNote>
        The site gives this project its own shot on the camera path and grows its mark out of stone.
        Upload one below and that mark is your logo; leave it empty and the project grows its own
        initial instead, which is a designed state rather than a gap.
      </PageHeaderNote>

      <ProjectForm disciplines={disciplines} />
    </>
  );
}

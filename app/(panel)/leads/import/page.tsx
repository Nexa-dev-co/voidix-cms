import { ImportWizard } from "@/app/(panel)/leads/import/ImportWizard";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ImportLeadsPage() {
  const member = await requireMember();
  const canAssign = member.role === "ADMIN";

  const members = canAssign
    ? await prisma.teamMember.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      })
    : [];

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Leads"
        title="Import a spreadsheet"
        description={
          canAssign
            ? "Read the file, check the columns, decide who gets the leads, then commit. Nothing is written until the last step."
            : "Read the file, check the columns, then commit. Imported leads are assigned to you."
        }
      />

      <ImportWizard members={members} canAssign={canAssign} />
    </ReadingColumn>
  );
}

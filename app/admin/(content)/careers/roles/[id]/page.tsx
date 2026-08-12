import { notFound } from "next/navigation";

import { deleteRoleAction } from "@/app/admin/(content)/careers/actions";
import { RoleForm } from "@/app/admin/(content)/careers/RoleForm";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditRolePage(props: PageProps<"/admin/careers/roles/[id]">) {
  const { id } = await props.params;

  const role = await prisma.careerRole.findUnique({
    where: { id },
    include: { bullets: { orderBy: { sortOrder: "asc" } } },
  });

  if (!role) {
    notFound();
  }

  const bulletsOfKind = (kind: "OWNS" | "NEEDS" | "BONUS") =>
    role.bullets.filter((bullet) => bullet.kind === kind).map((bullet) => bullet.label);

  return (
    <>
      <PageHeader
        eyebrow={`Role ${formatOrdinal(role.sortOrder)}`}
        title={role.title}
        description="Closing a role means deleting it — the page has an honest empty state and does not need a placeholder standing in."
      />

      <RoleForm
        role={{
          id: role.id,
          title: role.title,
          location: role.location,
          commitment: role.commitment,
          owns: bulletsOfKind("OWNS"),
          needs: bulletsOfKind("NEEDS"),
          bonus: bulletsOfKind("BONUS"),
          briefSeed: role.briefSeed,
        }}
      />

      <DangerZone
        id={role.id}
        deleteAction={deleteRoleAction}
        title="Delete this role"
        description="Removes the posting from the draft along with its three lists, and renumbers the rest. The last published release keeps its own copy until you publish again."
        confirmMessage={`Delete "${role.title}"? This can't be undone.`}
        buttonLabel="Delete role"
      />
    </>
  );
}

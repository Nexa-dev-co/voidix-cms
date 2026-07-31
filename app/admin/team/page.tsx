import { MemberRow } from "@/app/admin/team/MemberRow";
import { NewMemberForm } from "@/app/admin/team/NewMemberForm";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAuthAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const currentMember = await requireAdmin();

  const members = await prisma.teamMember.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignedContacts: true } } },
  });

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Access"
        title="Team"
        description="Who can sign in, and what they're allowed to do. Adding someone here creates their login too."
      />

      {!isAuthAdminConfigured() && (
        <PageHeaderNote>
          <code className="text-fg">SUPABASE_SERVICE_ROLE_KEY</code> isn&rsquo;t set, so logins
          can&rsquo;t be created from this page. Add it to <code className="text-fg">.env</code>{" "}
          and restart, or create accounts in the Supabase dashboard instead.
        </PageHeaderNote>
      )}

      <div className="mb-8 flex flex-col divide-y divide-border border-y border-border">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            isSelf={member.id === currentMember.id}
            member={{
              id: member.id,
              name: member.name,
              email: member.email,
              role: member.role,
              isActive: member.isActive,
              hasLogin: Boolean(member.authUserId),
              assignedCount: member._count.assignedContacts,
            }}
          />
        ))}
      </div>

      <NewMemberForm />
    </ReadingColumn>
  );
}

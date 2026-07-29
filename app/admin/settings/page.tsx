import { SettingsForm } from "@/app/admin/settings/SettingsForm";
import { VocabularyEditor } from "@/app/admin/settings/VocabularyEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();

  const [settings, members, channels, outcomes] = await Promise.all([
    getLeadSettings(),
    prisma.teamMember.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.attemptChannel.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.attemptOutcome.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Lead settings"
        description="How leads are routed, what the Sales role may do, and the vocabulary used when logging an attempt."
      />

      <SettingsForm settings={settings} members={members} />

      <div className="mt-12 flex flex-col gap-8 border-t border-border pt-8">
        <h2 className="eyebrow">Logging an attempt</h2>

        <VocabularyEditor
          kind="channel"
          title="Channels"
          hint="How someone was contacted. Retiring one hides it from the form without touching past records."
          entries={channels}
        />

        <VocabularyEditor
          kind="outcome"
          title="Outcomes"
          hint="How the attempt went. Word these the way your team actually talks."
          entries={outcomes}
        />
      </div>
    </>
  );
}

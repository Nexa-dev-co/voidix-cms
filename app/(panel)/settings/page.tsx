import { ColumnLayoutEditor, type LayoutRow } from "@/app/(panel)/settings/ColumnLayoutEditor";
import { CustomFieldEditor } from "@/app/(panel)/settings/CustomFieldEditor";
import { SettingsForm } from "@/app/(panel)/settings/SettingsForm";
import { StageEditor } from "@/app/(panel)/settings/StageEditor";
import { VocabularyEditor } from "@/app/(panel)/settings/VocabularyEditor";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireAdmin } from "@/lib/auth";
import { getAllFieldDefinitions, getActiveFieldDefinitions } from "@/lib/leads/customFields";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { getAllStages } from "@/lib/leads/pipeline";
import { parseColumnLayout, resolveColumns } from "@/lib/leads/tableColumns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();

  const [settings, members, channels, outcomes, stages, allDefinitions, activeDefinitions] =
    await Promise.all([
      getLeadSettings(),
      prisma.teamMember.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.attemptChannel.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.attemptOutcome.findMany({ orderBy: { sortOrder: "asc" } }),
      getAllStages(),
      getAllFieldDefinitions(),
      getActiveFieldDefinitions(),
    ]);

  // Only active fields get a column — a retired one is hidden everywhere, and offering it here
  // would be a second place to control visibility.
  const layoutRows: LayoutRow[] = resolveColumns(
    parseColumnLayout(settings.leadsTableColumns),
    activeDefinitions,
  ).map((column) => ({
    key: column.key,
    label: column.label,
    width: column.width,
    visible: column.visible,
    isLocked: column.isLocked,
    source: column.definition ? "custom" : "builtin",
  }));

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Admin"
        title="Lead settings"
        description="How leads are routed, what the Sales role may do, the pipeline they move through, and what the leads table shows."
      />

      <SettingsForm settings={settings} members={members} />

      <div className="mt-12 flex flex-col gap-8 border-t border-border pt-8">
        <h2 className="eyebrow">The pipeline</h2>

        <StageEditor stages={stages} />
      </div>

      <div className="mt-12 flex flex-col gap-8 border-t border-border pt-8">
        <h2 className="eyebrow">What you record about a person</h2>

        <CustomFieldEditor definitions={allDefinitions} />

        <ColumnLayoutEditor rows={layoutRows} />
      </div>

      <div className="mt-12 flex flex-col gap-8 border-t border-border pt-8">
        <h2 className="eyebrow">Logging an attempt</h2>

        <VocabularyEditor
          kind="channel"
          title="Channels"
          hint="How someone was contacted. Retiring one hides it from the wizard without touching past records."
          entries={channels}
        />

        <VocabularyEditor
          kind="outcome"
          title="Outcomes"
          hint="How the attempt went. Word these the way your team actually talks — the first one matching “no answer” is what the quick button on a contact records."
          entries={outcomes}
        />
      </div>
    </ReadingColumn>
  );
}

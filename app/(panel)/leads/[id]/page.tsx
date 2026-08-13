import { notFound } from "next/navigation";

import {
  deleteContactAction,
  setContactArchivedAction,
  setContactStageAction,
} from "@/app/(panel)/leads/actions";
import { AssignSelect } from "@/app/(panel)/leads/AssignSelect";
import { ContactNotesForm } from "@/app/(panel)/leads/ContactNotesForm";
import { CustomFieldsForm } from "@/app/(panel)/leads/CustomFieldsForm";
import { FollowUpWizard } from "@/app/(panel)/leads/FollowUpWizard";
import { QuickNoAnswerButton } from "@/app/(panel)/leads/QuickNoAnswerButton";
import { EnquirySource, StageKind, TeamRole } from "@/generated/prisma/enums";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { Button } from "@/components/ui/Button";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { getActiveFieldDefinitions, getCustomFieldCells } from "@/lib/leads/customFields";
import { resolveQuickFollowUp } from "@/lib/leads/followUp";
import { describeOrigin, ORIGIN_TONES, summariseOrigin } from "@/lib/leads/leadOrigin";
import { getAttemptVocabulary, getLeadSettings } from "@/lib/leads/leadSettings";
import { getActiveStages, getSelectableStages } from "@/lib/leads/pipeline";
import { canEditContactDetails, canSeeOthersAttempts, canViewContact } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<EnquirySource, string> = {
  CONTACT_FORM: "Website form",
  MANUAL: "Added by hand",
  IMPORT: "Imported",
};

const STAGE_TONE: Record<StageKind, string> = {
  OPEN: "border-accent text-accent",
  WON: "border-success text-success",
  LOST: "border-danger text-danger",
};

/** One entry in the merged history: attempts, stage moves and enquiries in one story. */
interface TimelineEntry {
  id: string;
  at: Date;
  kind: "attempt" | "stage" | "enquiry";
  title: string;
  byline: string | null;
  body: string | null;
  detail: string | null;
}

export default async function ContactDetailPage(props: PageProps<"/leads/[id]">) {
  const member = await requireMember();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      stage: { select: { id: true, label: true, kind: true } },
      assignedTo: { select: { id: true, name: true } },
      originBatch: { select: { filename: true } },
      enquiries: {
        orderBy: { createdAt: "desc" },
        include: { importBatch: { select: { filename: true } } },
      },
    },
  });

  // notFound rather than a redirect: a salesperson probing ids should not be able to tell "this
  // lead exists but isn't yours" from "no such lead".
  if (!contact || !(await canViewContact(member, contact))) {
    notFound();
  }

  const showAllAttempts = await canSeeOthersAttempts(member);

  const [attempts, stageChanges, vocabulary, teamMembers, settings, stages, selectableStages, definitions] =
    await Promise.all([
      prisma.contactAttempt.findMany({
        where: { contactId: contact.id, ...(showAllAttempts ? {} : { memberId: member.id }) },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contactStageChange.findMany({
        where: { contactId: contact.id },
        orderBy: { createdAt: "desc" },
      }),
      getAttemptVocabulary(),
      member.role === TeamRole.ADMIN
        ? prisma.teamMember.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      getLeadSettings(),
      getActiveStages(),
      getSelectableStages(member),
      getActiveFieldDefinitions(),
    ]);

  const customCells = await getCustomFieldCells(contact.id, definitions);

  const canClaim =
    member.role !== TeamRole.ADMIN &&
    contact.assignedToId === null &&
    settings.salesCanClaimUnassigned;
  const canEditCustomFields =
    member.role === TeamRole.ADMIN ||
    (settings.salesCanEditCustomFields && (await canEditContactDetails(member)));
  const selectableStageIds = new Set(selectableStages.map((stage) => stage.id));
  const quickFollowUp = resolveQuickFollowUp(vocabulary.channels, vocabulary.outcomes);
  const wasMerged = searchParams.merged === "1";
  const origin = summariseOrigin(contact);

  // Stage changes made by the wizard already carry the attempt that caused them, so rendering
  // both would show the same event twice a second apart.
  const attemptIdsWithStageMove = new Set(
    stageChanges.map((change) => change.attemptId).filter((value): value is string => value !== null),
  );

  const timeline: TimelineEntry[] = [
    ...attempts.map((attempt) => ({
      id: attempt.id,
      at: attempt.createdAt,
      kind: "attempt" as const,
      title: `${attempt.channel} · ${attempt.outcome}`,
      byline: attempt.memberName,
      body: attempt.note,
      detail: attempt.nextDueAt ? `Next: ${formatDate(attempt.nextDueAt)}` : null,
    })),
    ...stageChanges
      .filter((change) => change.attemptId === null || !attemptIdsWithStageMove.has(change.attemptId))
      .map((change) => ({
        id: change.id,
        at: change.createdAt,
        kind: "stage" as const,
        title: change.fromStage
          ? `${change.fromStage} → ${change.toStage}`
          : `Started at ${change.toStage}`,
        byline: change.memberName,
        body: change.reason,
        detail: null,
      })),
    ...contact.enquiries.map((enquiry) => ({
      id: enquiry.id,
      at: enquiry.createdAt,
      kind: "enquiry" as const,
      title: SOURCE_LABELS[enquiry.source],
      byline: null,
      body: enquiry.message,
      detail: enquiry.importBatch ? `Appeared in ${enquiry.importBatch.filename}` : null,
    })),
  ].sort((left, right) => right.at.getTime() - left.at.getTime());

  // A move made through the wizard is rendered on the attempt, so the label goes there.
  const stageMoveByAttempt = new Map(
    stageChanges
      .filter((change) => change.attemptId !== null)
      .map((change) => [change.attemptId as string, change]),
  );

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow={`${attempts.length} attempt${attempts.length === 1 ? "" : "s"} · ${contact.enquiries.length} touchpoint${contact.enquiries.length === 1 ? "" : "s"}`}
        title={contact.name}
        description={
          <>
            <a href={`mailto:${contact.email}`} className="text-accent hover:underline">
              {contact.email}
            </a>
            {contact.phone && (
              <>
                {" · "}
                <a href={`tel:${contact.phone}`} className="text-accent hover:underline">
                  {contact.phone}
                </a>
              </>
            )}
            {contact.company ? ` · ${contact.company}` : ""}
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {quickFollowUp && (
              <QuickNoAnswerButton
                contactId={contact.id}
                outcomeLabel={quickFollowUp.outcome}
                days={quickFollowUp.days}
              />
            )}
            <FollowUpWizard
              contactId={contact.id}
              contactName={contact.name.split(" ")[0]}
              channels={vocabulary.channels}
              outcomes={vocabulary.outcomes}
              stages={selectableStages.map((stage) => ({
                id: stage.id,
                label: stage.label,
                kind: stage.kind,
              }))}
              currentStageId={contact.stageId}
            />
          </div>
        }
      />

      {wasMerged && (
        <div className="mb-6 rounded-sm border border-accent/30 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-accent">
          That email was already here, so the entry was added to this person&rsquo;s history rather
          than creating a second record.
        </div>
      )}

      {contact.isArchived && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border-strong bg-card px-4 py-3 text-xs text-muted">
          <span>Archived — hidden from the working list.</span>
          <form action={setContactArchivedAction}>
            <input type="hidden" name="id" value={contact.id} />
            <input type="hidden" name="isArchived" value="false" />
            <Button type="submit" variant="secondary">
              Restore
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="eyebrow mb-3">Stage</h2>
          <div className="flex flex-wrap gap-2">
            {stages.map((stage) => {
              const isCurrent = stage.id === contact.stageId;
              const isAllowed = selectableStageIds.has(stage.id);

              return (
                <form key={stage.id} action={setContactStageAction}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="stageId" value={stage.id} />
                  <button
                    type="submit"
                    disabled={isCurrent || !isAllowed}
                    title={
                      !isAllowed && !isCurrent
                        ? "Marking a lead won or lost is an admin's call on this team."
                        : undefined
                    }
                    className={`rounded-sm border px-3 py-1.5 text-xs transition-colors duration-150 disabled:cursor-not-allowed ${
                      isCurrent
                        ? STAGE_TONE[stage.kind]
                        : isAllowed
                          ? "border-border-strong text-muted hover:border-accent hover:text-accent"
                          : "border-border text-muted/30"
                    }`}
                  >
                    {stage.label}
                  </button>
                </form>
              );
            })}
          </div>

          {contact.nextFollowUpAt && (
            <p className="mt-3 text-xs text-muted">
              Next follow-up{" "}
              <time
                dateTime={contact.nextFollowUpAt.toISOString()}
                className={
                  contact.stage.kind === StageKind.OPEN && contact.nextFollowUpAt < new Date()
                    ? "text-danger"
                    : "text-fg"
                }
              >
                {formatDate(contact.nextFollowUpAt)}
              </time>
            </p>
          )}
        </section>

        {/* Two across from `sm`, three only once there is room for the origin sentence to sit
            beside the other two without wrapping into a column of single words. */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0">
            <h2 className="eyebrow mb-3">How they got here</h2>
            <p
              className={`inline-block max-w-full truncate rounded-sm border px-2 py-1 text-xs ${ORIGIN_TONES[origin.channel]}`}
            >
              {origin.label}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              {describeOrigin(origin)}
              {" on "}
              {formatDate(contact.createdAt)}.
            </p>
          </div>

          <div>
            <h2 className="eyebrow mb-3">Owner</h2>
            {member.role === TeamRole.ADMIN ? (
              <AssignSelect
                contactId={contact.id}
                assignedToId={contact.assignedToId}
                members={teamMembers}
              />
            ) : canClaim ? (
              <AssignSelect
                contactId={contact.id}
                assignedToId={null}
                members={[{ id: member.id, name: `${member.name} (claim)` }]}
              />
            ) : (
              <p className="text-sm text-muted">{contact.assignedTo?.name ?? "Unassigned"}</p>
            )}
          </div>

          {!contact.isArchived && (
            <div>
              <h2 className="eyebrow mb-3">Working list</h2>
              <form action={setContactArchivedAction}>
                <input type="hidden" name="id" value={contact.id} />
                <input type="hidden" name="isArchived" value="true" />
                <Button type="submit" variant="secondary">
                  Archive
                </Button>
              </form>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Takes them out of the list without deleting anything.
              </p>
            </div>
          )}
        </section>

        {definitions.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Details</h2>
            <CustomFieldsForm
              contactId={contact.id}
              definitions={definitions}
              cells={customCells}
              canEdit={canEditCustomFields}
            />
          </section>
        )}

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">History</h2>
            {!showAllAttempts && <span className="text-[11px] text-muted/60">your attempts only</span>}
          </div>

          {timeline.length === 0 ? (
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border border-y border-border">
              {timeline.map((entry) => {
                const stageMove =
                  entry.kind === "attempt" ? stageMoveByAttempt.get(entry.id) : undefined;

                return (
                  <li key={`${entry.kind}-${entry.id}`} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p
                        className={
                          entry.kind === "enquiry" ? "text-xs text-accent" : "text-sm text-fg"
                        }
                      >
                        {entry.title}
                      </p>
                      <time
                        dateTime={entry.at.toISOString()}
                        className="text-[11px] text-muted/60"
                      >
                        {entry.at.toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    </div>

                    {(entry.byline || stageMove) && (
                      <p className="mt-0.5 text-[11px] text-muted/60">
                        {entry.byline}
                        {stageMove && (
                          <span className="text-accent">
                            {" · "}
                            {stageMove.fromStage} → {stageMove.toStage}
                          </span>
                        )}
                      </p>
                    )}

                    {/* whitespace-pre-line, never an HTML render — enquiry text came from a
                        stranger and must not be interpreted as markup. */}
                    {entry.body && (
                      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                        {entry.body}
                      </p>
                    )}

                    {stageMove?.reason && (
                      <p className="mt-1 text-xs leading-relaxed text-muted">{stageMove.reason}</p>
                    )}

                    {entry.detail && <p className="mt-1 text-[11px] text-muted">{entry.detail}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <ContactNotesForm id={contact.id} notes={contact.notes ?? ""} />
        </section>
      </div>

      {member.role === TeamRole.ADMIN && (
        <DangerZone
          id={contact.id}
          deleteAction={deleteContactAction}
          title="Delete this person"
          description="Removes them, every touchpoint and every logged attempt, permanently. This is a real delete, which is what an erasure request needs — to just get them out of the working list, archive instead."
          confirmMessage={`Delete ${contact.name} and all their history? This can't be undone.`}
          buttonLabel="Delete contact"
        />
      )}
    </ReadingColumn>
  );
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

import { notFound } from "next/navigation";

import { deleteContactAction, setContactStatusAction } from "@/app/admin/leads/actions";
import { AssignSelect } from "@/app/admin/leads/AssignSelect";
import { AttemptForm } from "@/app/admin/leads/AttemptForm";
import { ContactNotesForm } from "@/app/admin/leads/ContactNotesForm";
import { EnquirySource, LeadStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/Button";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { getAttemptVocabulary, getLeadSettings } from "@/lib/leads/leadSettings";
import { canSeeOthersAttempts, canViewContact } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_ACTIONS = [
  { status: LeadStatus.NEW, label: "New" },
  { status: LeadStatus.READ, label: "Read" },
  { status: LeadStatus.ARCHIVED, label: "Archived" },
] as const;

const SOURCE_LABELS: Record<EnquirySource, string> = {
  CONTACT_FORM: "Website form",
  MANUAL: "Added by hand",
  IMPORT: "Imported",
};

export default async function ContactDetailPage(props: PageProps<"/admin/leads/[id]">) {
  const member = await requireMember();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      enquiries: {
        orderBy: { createdAt: "desc" },
        include: { importBatch: { select: { filename: true } } },
      },
    },
  });

  // notFound rather than a redirect: a salesperson probing ids should not be able to tell
  // "this lead exists but isn't yours" from "no such lead".
  if (!contact || !(await canViewContact(member, contact))) {
    notFound();
  }

  const showAllAttempts = await canSeeOthersAttempts(member);

  const [attempts, vocabulary, teamMembers, settings] = await Promise.all([
    prisma.contactAttempt.findMany({
      where: {
        contactId: contact.id,
        ...(showAllAttempts ? {} : { memberId: member.id }),
      },
      orderBy: { createdAt: "desc" },
    }),
    getAttemptVocabulary(),
    member.role === "ADMIN"
      ? prisma.teamMember.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    getLeadSettings(),
  ]);

  const canClaim =
    member.role !== "ADMIN" && contact.assignedToId === null && settings.salesCanClaimUnassigned;
  const wasMerged = searchParams.merged === "1";

  return (
    <>
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
      />

      {wasMerged && (
        <div className="mb-6 rounded-sm border border-accent/30 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-accent">
          That email was already here, so the entry was added to this person&rsquo;s history
          rather than creating a second record.
        </div>
      )}

      <div className="flex flex-col gap-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="eyebrow mb-3">Owner</h2>
            {member.role === "ADMIN" ? (
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

          <div>
            <h2 className="eyebrow mb-3">Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_ACTIONS.map((action) => (
                <form key={action.status} action={setContactStatusAction}>
                  <input type="hidden" name="id" value={contact.id} />
                  <input type="hidden" name="status" value={action.status} />
                  <Button
                    type="submit"
                    variant={contact.status === action.status ? "primary" : "secondary"}
                    disabled={contact.status === action.status}
                  >
                    {action.label}
                  </Button>
                </form>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-3">Log an attempt</h2>
          <AttemptForm
            contactId={contact.id}
            channels={vocabulary.channels}
            outcomes={vocabulary.outcomes}
          />
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">Attempts</h2>
            {!showAllAttempts && (
              <span className="text-[11px] text-muted/60">yours only</span>
            )}
          </div>

          {attempts.length === 0 ? (
            <p className="text-sm text-muted">
              {showAllAttempts ? "Nobody has tried to reach them yet." : "You haven't tried to reach them yet."}
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border border-y border-border">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-fg">
                      {attempt.channel}
                      <span className="text-muted"> · {attempt.outcome}</span>
                    </p>
                    <time
                      dateTime={attempt.createdAt.toISOString()}
                      className="text-[11px] text-muted/60"
                    >
                      {attempt.createdAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted/60">{attempt.memberName}</p>
                  {attempt.note && (
                    <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                      {attempt.note}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h2 className="eyebrow mb-3">Where they came from</h2>
          <ol className="flex flex-col divide-y divide-border border-y border-border">
            {contact.enquiries.map((enquiry) => (
              <li key={enquiry.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs text-accent">{SOURCE_LABELS[enquiry.source]}</p>
                  <time
                    dateTime={enquiry.createdAt.toISOString()}
                    className="text-[11px] text-muted/60"
                  >
                    {enquiry.createdAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>

                {enquiry.message ? (
                  /* whitespace-pre-line, never an HTML render — this text came from a
                     stranger and must not be interpreted as markup. */
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
                    {enquiry.message}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted">
                    {enquiry.importBatch
                      ? `Appeared in ${enquiry.importBatch.filename}`
                      : "No message."}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <ContactNotesForm id={contact.id} notes={contact.notes ?? ""} />
        </section>
      </div>

      {member.role === "ADMIN" && (
        <DangerZone
          id={contact.id}
          deleteAction={deleteContactAction}
          title="Delete this person"
          description="Removes them, every touchpoint and every logged attempt, permanently. This is a real delete, which is what an erasure request needs — to just get them out of the working list, archive instead."
          confirmMessage={`Delete ${contact.name} and all their history? This can't be undone.`}
          buttonLabel="Delete contact"
        />
      )}
    </>
  );
}

import { EnquirySource } from "@/generated/prisma/enums";
import { deriveNameFromEmail } from "@/lib/leads/contactFields";
import { originColumns } from "@/lib/leads/leadOrigin";
import { pickAutoAssignee } from "@/lib/leads/leadSettings";
import { getDefaultStage } from "@/lib/leads/pipeline";
import { prisma } from "@/lib/prisma";

/**
 * Turns an inbox submission into a lead.
 *
 * ⚠ THIS IS THE ONLY PATH from `submissions` to `contacts`, and it is the fourth intake route —
 * the website form used to be one of three, and this replaced it. Everything the old
 * `POST /api/leads` did to a contact happens here instead, which is why the deduplication, the
 * auto-assignment and `originColumns` all live in this one function rather than at intake.
 *
 * Deduplication is the part worth reading. `contacts.email` is unique and the panel's oldest
 * rule is that a person is one row: somebody enquiring a second time is not a duplicate, it is
 * the same person with more to say. So promoting a submission whose email is already known
 * appends an `Enquiry` to that person rather than creating a second contact — the same behaviour
 * the intake route used to have, moved to the point where an admin can see the result.
 *
 * `origin_*` is written only when the contact is created, never on a later promotion, because it
 * answers "how did this person get here" once and is never rewritten. A person imported in March
 * who submits the form in June was still added by the import.
 */
export interface PromotionResult {
  contactId: string;
  /** True when the submission joined somebody already in the pipeline. */
  joinedExistingContact: boolean;
}

export async function promoteSubmission(
  submissionId: string,
  promotedById: string,
): Promise<PromotionResult | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      message: true,
      phone: true,
      source: true,
      ipHash: true,
      userAgent: true,
      promotedAt: true,
    },
  });

  if (!submission || submission.promotedAt) {
    // Already promoted, or gone. Silently doing it again would create a second enquiry from one
    // message — a double-clicked button should not double-count a person's interest.
    return null;
  }

  const existing = await prisma.contact.findUnique({
    where: { email: submission.email },
    select: { id: true, company: true, phone: true },
  });

  if (existing) {
    // Fill a gap if they supplied something we lacked, but never overwrite — the record may have
    // been corrected by hand, and an anonymous form post shouldn't undo that. The phone follows the
    // company's rule for the company's reason; it is listed here only because the enquiry form had
    // nowhere to send one until the site was connected.
    const gapFills = {
      ...(!existing.company && submission.company ? { company: submission.company } : {}),
      ...(!existing.phone && submission.phone ? { phone: submission.phone } : {}),
    };

    await prisma.$transaction([
      prisma.enquiry.create({
        data: {
          contactId: existing.id,
          source: EnquirySource.CONTACT_FORM,
          message: submission.message,
          ipHash: submission.ipHash,
          userAgent: submission.userAgent,
        },
      }),
      ...(Object.keys(gapFills).length > 0
        ? [prisma.contact.update({ where: { id: existing.id }, data: gapFills })]
        : []),
      prisma.submission.update({
        where: { id: submission.id },
        data: { promotedAt: new Date(), promotedContactId: existing.id, promotedById },
      }),
    ]);

    return { contactId: existing.id, joinedExistingContact: true };
  }

  // Routing is a policy decision an admin makes under Settings, not something this should
  // hardcode. Returns null when nothing applies, leaving the lead unassigned.
  const assignedToId = await pickAutoAssignee();
  // Somebody who just filled in the form has by definition not been worked yet.
  const defaultStage = await getDefaultStage();

  const contact = await prisma.contact.create({
    data: {
      // ⚠ `contacts.name` is required and a submission's is not — the site's form asks for exactly
      // one field, the address to reply to. A blank name becomes a readable guess from the address
      // rather than the raw address: "Julia Roberts", not "julia.roberts@corp.com" sitting in the
      // panel as a person's name. Same helper, same reasoning as the spreadsheet importer.
      name: submission.name ?? deriveNameFromEmail(submission.email),
      email: submission.email,
      company: submission.company,
      phone: submission.phone,
      stageId: defaultStage.id,
      assignedToId,
      assignedAt: assignedToId ? new Date() : null,
      // Nobody *added* this lead — they arrived through the form — so no member is recorded even
      // though a member pressed the button. Promoting is not the same as sourcing.
      ...originColumns({ via: "CONTACT_FORM", label: submission.source }),
      enquiries: {
        create: [
          {
            source: EnquirySource.CONTACT_FORM,
            message: submission.message,
            ipHash: submission.ipHash,
            userAgent: submission.userAgent,
          },
        ],
      },
    },
    select: { id: true },
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: { promotedAt: new Date(), promotedContactId: contact.id, promotedById },
  });

  return { contactId: contact.id, joinedExistingContact: false };
}

import type { Prisma } from "@/generated/prisma/client";
import type { CurrentMember } from "@/lib/auth";
import { getLeadSettings } from "@/lib/leads/leadSettings";

/**
 * The one place that decides which contacts a person may see.
 *
 * Every list, count and detail lookup goes through this rather than each page rolling its
 * own filter — a query that forgets the condition is exactly how one salesperson ends up
 * reading another's pipeline, and that kind of leak is invisible until it matters.
 *
 * Admins see everything. Sales see only what is assigned to them, plus the unassigned pool if
 * an admin has opened that up in Settings.
 */
export async function buildContactVisibilityFilter(
  member: CurrentMember,
): Promise<Prisma.ContactWhereInput> {
  if (member.role === "ADMIN") {
    return {};
  }

  const settings = await getLeadSettings();

  if (settings.salesCanClaimUnassigned) {
    return { OR: [{ assignedToId: member.id }, { assignedToId: null }] };
  }

  return { assignedToId: member.id };
}

/**
 * Whether this person may open this specific contact.
 *
 * Used by the detail page, which must not rely on the list having filtered it out — the URL
 * is guessable and a direct visit bypasses the list entirely.
 */
export async function canViewContact(
  member: CurrentMember,
  contact: { assignedToId: string | null },
): Promise<boolean> {
  if (member.role === "ADMIN") {
    return true;
  }

  if (contact.assignedToId === member.id) {
    return true;
  }

  if (contact.assignedToId === null) {
    const settings = await getLeadSettings();
    return settings.salesCanClaimUnassigned;
  }

  return false;
}

/**
 * Whether this person may see attempts logged by other people.
 *
 * Off by default: a salesperson sees their own call history, not the whole team's.
 */
export async function canSeeOthersAttempts(member: CurrentMember): Promise<boolean> {
  if (member.role === "ADMIN") {
    return true;
  }

  const settings = await getLeadSettings();

  return settings.salesCanSeeOthersAttempts;
}

export async function canEditContactDetails(member: CurrentMember): Promise<boolean> {
  if (member.role === "ADMIN") {
    return true;
  }

  const settings = await getLeadSettings();

  return settings.salesCanEditContact;
}

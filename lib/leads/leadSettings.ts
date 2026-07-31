import { AutoAssignMode } from "@/generated/prisma/enums";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export interface LeadSettingsValues {
  autoAssignMode: AutoAssignMode;
  autoAssignMemberId: string | null;
  lastAssignedMemberId: string | null;
  salesCanEditContact: boolean;
  salesCanClaimUnassigned: boolean;
  salesCanExport: boolean;
  salesCanSeeOthersAttempts: boolean;
  salesCanCloseLeads: boolean;
  salesCanEditCustomFields: boolean;
  importDefaultMatchAction: string;
  importMaxRows: number;
  importAllowOverwrite: boolean;
  /** Raw `Json` — parsed through `parseColumnLayout`, which is defensive about its shape. */
  leadsTableColumns: unknown;
}

/**
 * The defaults a brand-new install runs on.
 *
 * Every permission a salesperson could be given starts off, and inbound leads start
 * unassigned. Settings that widen access should be opted into deliberately, not inherited by
 * whoever forgets to look at this page.
 */
export const DEFAULT_LEAD_SETTINGS: LeadSettingsValues = {
  autoAssignMode: AutoAssignMode.UNASSIGNED,
  autoAssignMemberId: null,
  lastAssignedMemberId: null,
  salesCanEditContact: true,
  salesCanClaimUnassigned: false,
  salesCanExport: false,
  salesCanSeeOthersAttempts: false,
  salesCanCloseLeads: false,
  salesCanEditCustomFields: false,
  importDefaultMatchAction: "enrich",
  importMaxRows: 5000,
  importAllowOverwrite: true,
  leadsTableColumns: [],
};

/**
 * Current settings, falling back to the defaults when the row has never been saved.
 *
 * Returns defaults rather than throwing, so lead handling keeps working on a fresh database
 * where nobody has opened the Settings page yet.
 */
export async function getLeadSettings(): Promise<LeadSettingsValues> {
  const settings = await prisma.leadSettings.findUnique({ where: { id: SINGLETON_ROW_ID } });

  if (!settings) {
    return DEFAULT_LEAD_SETTINGS;
  }

  return {
    autoAssignMode: settings.autoAssignMode,
    autoAssignMemberId: settings.autoAssignMemberId,
    lastAssignedMemberId: settings.lastAssignedMemberId,
    salesCanEditContact: settings.salesCanEditContact,
    salesCanClaimUnassigned: settings.salesCanClaimUnassigned,
    salesCanExport: settings.salesCanExport,
    salesCanSeeOthersAttempts: settings.salesCanSeeOthersAttempts,
    salesCanCloseLeads: settings.salesCanCloseLeads,
    salesCanEditCustomFields: settings.salesCanEditCustomFields,
    importDefaultMatchAction: settings.importDefaultMatchAction,
    importMaxRows: settings.importMaxRows,
    importAllowOverwrite: settings.importAllowOverwrite,
    leadsTableColumns: settings.leadsTableColumns,
  };
}

/**
 * Picks the owner for a newly arrived website lead.
 *
 * Round-robin reads the stored pointer and takes the next active salesperson in name order,
 * then writes the pointer back — the rotation has to survive between requests, and on
 * serverless there is no process memory to keep it in.
 *
 * Returns `null` when nothing applies, which leaves the lead unassigned rather than guessing.
 */
export async function pickAutoAssignee(): Promise<string | null> {
  const settings = await getLeadSettings();

  if (settings.autoAssignMode === AutoAssignMode.UNASSIGNED) {
    return null;
  }

  if (settings.autoAssignMode === AutoAssignMode.FIXED) {
    if (!settings.autoAssignMemberId) {
      return null;
    }

    // Verify they're still active — a deactivated person shouldn't keep collecting leads.
    const member = await prisma.teamMember.findFirst({
      where: { id: settings.autoAssignMemberId, isActive: true },
      select: { id: true },
    });

    return member?.id ?? null;
  }

  const rotation = await prisma.teamMember.findMany({
    where: { isActive: true, role: "SALES" },
    orderBy: { name: "asc" },
    select: { id: true },
  });

  if (rotation.length === 0) {
    return null;
  }

  const lastIndex = settings.lastAssignedMemberId
    ? rotation.findIndex((member) => member.id === settings.lastAssignedMemberId)
    : -1;
  const nextMember = rotation[(lastIndex + 1) % rotation.length];

  await prisma.leadSettings.upsert({
    where: { id: SINGLETON_ROW_ID },
    create: { id: SINGLETON_ROW_ID, lastAssignedMemberId: nextMember.id },
    update: { lastAssignedMemberId: nextMember.id },
  });

  return nextMember.id;
}

/** The active channel and outcome vocabulary for the log-an-attempt form. */
export async function getAttemptVocabulary() {
  const [channels, outcomes] = await Promise.all([
    prisma.attemptChannel.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.attemptOutcome.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return { channels, outcomes };
}

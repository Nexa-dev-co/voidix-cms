import { StageKind, TeamRole } from "@/generated/prisma/enums";
import type { CurrentMember } from "@/lib/auth";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { prisma } from "@/lib/prisma";

export interface PipelineStageSummary {
  id: string;
  label: string;
  kind: StageKind;
  sortOrder: number;
  isActive: boolean;
}

const STAGE_SELECT = {
  id: true,
  label: true,
  kind: true,
  sortOrder: true,
  isActive: true,
} as const;

/** Every stage, retired ones included. Settings needs the full list to offer "Restore". */
export async function getAllStages(): Promise<PipelineStageSummary[]> {
  return prisma.pipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: STAGE_SELECT,
  });
}

/** The stages a lead may currently be moved into. */
export async function getActiveStages(): Promise<PipelineStageSummary[]> {
  return prisma.pipelineStage.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: STAGE_SELECT,
  });
}

/**
 * Where a newly arrived lead lands.
 *
 * Falls back past `isActive` before giving up: an admin who retires the first stage should not
 * take the website form down with them. Throws only when the table is genuinely empty, which the
 * seeding migration makes impossible short of someone deleting rows by hand — and a loud failure
 * is better there than a contact written with a stage nobody chose.
 */
export async function getDefaultStage(): Promise<PipelineStageSummary> {
  const active = await prisma.pipelineStage.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: STAGE_SELECT,
  });

  if (active) {
    return active;
  }

  const anyStage = await prisma.pipelineStage.findFirst({
    orderBy: { sortOrder: "asc" },
    select: STAGE_SELECT,
  });

  if (!anyStage) {
    throw new Error(
      "No pipeline stages exist. Every lead needs one — re-seed them from the Settings page.",
    );
  }

  return anyStage;
}

/** Whether a stage ends the conversation. */
export function isClosedStage(stage: { kind: StageKind }): boolean {
  return stage.kind !== StageKind.OPEN;
}

/**
 * Whether this person may move a lead into this stage.
 *
 * Sales work their leads through the open stages freely; declaring one Won or Lost is what the
 * business reports on, so it sits behind a setting that defaults to off.
 */
export async function canMoveToStage(
  member: CurrentMember,
  stage: { kind: StageKind },
): Promise<boolean> {
  if (member.role === TeamRole.ADMIN || !isClosedStage(stage)) {
    return true;
  }

  const settings = await getLeadSettings();

  return settings.salesCanCloseLeads;
}

/** The stages to offer this person in a stage picker. */
export async function getSelectableStages(
  member: CurrentMember,
): Promise<PipelineStageSummary[]> {
  const stages = await getActiveStages();

  if (member.role === TeamRole.ADMIN) {
    return stages;
  }

  const settings = await getLeadSettings();

  return settings.salesCanCloseLeads ? stages : stages.filter((stage) => !isClosedStage(stage));
}

"use server";

import { revalidatePath } from "next/cache";

import { TeamRole } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { formErrorFromZod } from "@/lib/forms/formState";
import {
  IDLE_TEAM_FORM_STATE,
  teamFormError,
  type TeamFormState,
} from "@/lib/forms/teamFormState";
import { prisma } from "@/lib/prisma";
import {
  createOrLinkAuthUser,
  deleteAuthUser,
  isAuthAdminConfigured,
  resetAuthUserPassword,
} from "@/lib/supabase/admin";
import { teamMemberSchema } from "@/lib/validation/contactSchemas";

/**
 * Creates a team member AND their login, in that order.
 *
 * The two halves are still separate records — Supabase Auth owns the credential, `team_members`
 * owns the role — but an admin should never have to visit two dashboards to onboard someone,
 * so this does both and hands back a one-time password.
 *
 * If either half fails the other is undone, because a team row without a login is a person who
 * can't sign in, and a login without a team row is an account that sees nothing. Both are
 * confusing to discover later.
 */
export async function createTeamMemberAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireAdmin();

  if (!isAuthAdminConfigured()) {
    return teamFormError(
      "SUPABASE_SERVICE_ROLE_KEY isn't set, so logins can't be created from here. Add it to .env and restart.",
    );
  }

  const parsed = teamMemberSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    role: String(formData.get("role") ?? "SALES"),
  });

  if (!parsed.success) {
    return { ...IDLE_TEAM_FORM_STATE, ...formErrorFromZod(parsed.error) };
  }

  const { name, email, role } = parsed.data;

  const existingMember = await prisma.teamMember.findUnique({ where: { email } });

  if (existingMember) {
    return teamFormError("Someone with that email is already on the team.");
  }

  let authUser;

  try {
    authUser = await createOrLinkAuthUser(email);
  } catch (error) {
    return teamFormError(error instanceof Error ? error.message : "Couldn't create that login.");
  }

  try {
    await prisma.teamMember.create({
      data: { name, email, role, authUserId: authUser.authUserId },
    });
  } catch (error) {
    // Roll the login back so a failed add doesn't strand an orphan account that can sign in
    // and land on /no-access forever. Only for accounts this call created — an account that
    // already existed belongs to someone else's setup and isn't ours to delete.
    if (!authUser.alreadyExisted) {
      await deleteAuthUser(authUser.authUserId).catch(() => undefined);
    }

    return teamFormError(
      error instanceof Error ? error.message : "Couldn't add that person to the team.",
    );
  }

  revalidatePath("/team");

  return {
    status: "success",
    message: authUser.alreadyExisted
      ? `${name} already had a login, so it was linked to this team record. Their existing password still works.`
      : `${name} can sign in now.`,
    fieldErrors: {},
    createdEmail: email,
    temporaryPassword: authUser.temporaryPassword,
    linkedExistingLogin: authUser.alreadyExisted,
  };
}

/** Issues a fresh one-time password for someone who has lost theirs. */
export async function resetMemberPasswordAction(
  _previousState: TeamFormState,
  formData: FormData,
): Promise<TeamFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return teamFormError("Missing team member id.");
  }

  const member = await prisma.teamMember.findUnique({ where: { id } });

  if (!member) {
    return teamFormError("That person is no longer on the team.");
  }

  if (!member.authUserId) {
    return teamFormError(
      `${member.name} has no login yet. Remove and re-add them to create one.`,
    );
  }

  try {
    const temporaryPassword = await resetAuthUserPassword(member.authUserId);

    return {
      status: "success",
      message: `New password for ${member.name}.`,
      fieldErrors: {},
      createdEmail: member.email,
      temporaryPassword,
      linkedExistingLogin: false,
    };
  } catch (error) {
    return teamFormError(
      error instanceof Error ? error.message : "Couldn't reset that password.",
    );
  }
}

export async function setMemberRoleAction(formData: FormData) {
  const currentMember = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const rawRole = String(formData.get("role") ?? "");
  const role = rawRole === TeamRole.ADMIN || rawRole === TeamRole.SALES ? rawRole : null;

  if (!id || !role) {
    return;
  }

  // Stops the last admin demoting themselves and locking everyone out of site content and
  // team management, which nothing else could then undo from inside the app.
  if (id === currentMember.id && role !== TeamRole.ADMIN) {
    const adminCount = await prisma.teamMember.count({
      where: { role: TeamRole.ADMIN, isActive: true },
    });

    if (adminCount <= 1) {
      return;
    }
  }

  await prisma.teamMember.update({ where: { id }, data: { role } });

  revalidatePath("/team");
}

export async function setMemberActiveAction(formData: FormData) {
  const currentMember = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  if (!id) {
    return;
  }

  if (id === currentMember.id && !isActive) {
    const adminCount = await prisma.teamMember.count({
      where: { role: TeamRole.ADMIN, isActive: true },
    });

    if (adminCount <= 1) {
      return;
    }
  }

  // Deactivating rather than deleting keeps their name on the contacts they used to own —
  // deleting the row would quietly unassign that history. The login survives too, but
  // `getCurrentMember` refuses inactive members, so access stops at their next request.
  await prisma.teamMember.update({ where: { id }, data: { isActive } });

  revalidatePath("/team");
}

/**
 * Removes someone completely — team record and login together.
 *
 * Contacts they owned are left in place and become unassigned (`onDelete: SetNull`), so
 * deleting a person never takes lead history with them.
 */
export async function removeMemberAction(formData: FormData) {
  const currentMember = await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id || id === currentMember.id) {
    return;
  }

  const member = await prisma.teamMember.findUnique({ where: { id } });

  if (!member) {
    return;
  }

  if (member.authUserId) {
    await deleteAuthUser(member.authUserId).catch(() => undefined);
  }

  await prisma.teamMember.delete({ where: { id } });

  revalidatePath("/team");
}

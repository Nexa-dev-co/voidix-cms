import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { TeamRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in Supabase user, or `null`. Says nothing about permissions.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export interface CurrentMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
}

/**
 * The signed-in person's team record — the thing that actually carries their role.
 *
 * Supabase Auth proves who someone is; this proves what they may do. The two are linked by
 * email on first sign-in, so an account created in the Supabase dashboard without a matching
 * `team_members` row can authenticate but has no permissions at all. That is deliberate: a
 * new Auth user should not silently become an admin.
 *
 * Returns `null` when there is no session, no matching member, or the member is deactivated.
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const user = await getCurrentUser();

  if (!user?.email) {
    return null;
  }

  const email = user.email.toLowerCase();
  const member = await prisma.teamMember.findUnique({ where: { email } });

  if (!member || !member.isActive) {
    return null;
  }

  // Bind the auth id the first time we see it, so a later email change in Supabase doesn't
  // silently orphan the record.
  if (!member.authUserId) {
    await prisma.teamMember.update({
      where: { id: member.id },
      data: { authUserId: user.id },
    });
  }

  return { id: member.id, email: member.email, name: member.name, role: member.role };
}

/**
 * Any active team member, or a redirect.
 *
 * Every Server Action calls one of these guards itself. The proxy only checks that a session
 * exists — it does not know about roles, and Server Actions are reachable by direct POST
 * without passing through page routing at all, so a page-level check protects nothing on its
 * own.
 */
export async function requireMember(): Promise<CurrentMember> {
  const member = await getCurrentMember();

  if (!member) {
    // Distinguishes "signed in but not on the team" from "not signed in" — otherwise the
    // login page would bounce them straight back here in a loop.
    const user = await getCurrentUser();
    redirect(user ? "/no-access" : "/login");
  }

  return member;
}

/**
 * An admin, or a redirect. Guards everything that touches site copy, publishing or the team.
 */
export async function requireAdmin(): Promise<CurrentMember> {
  const member = await requireMember();

  if (member.role !== TeamRole.ADMIN) {
    redirect("/leads");
  }

  return member;
}

export function isAdmin(member: CurrentMember | null): boolean {
  return member?.role === TeamRole.ADMIN;
}

/**
 * Kept for the handful of places that only need "is there a session", such as the login flow.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

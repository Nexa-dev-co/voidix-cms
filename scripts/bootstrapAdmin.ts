import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { TeamRole } from "../generated/prisma/enums";

/**
 * Grants ADMIN to existing Supabase Auth accounts that have no team record yet.
 *
 * Permissions live in `team_members`, not in Supabase Auth, so an account created in the
 * Supabase dashboard can sign in but sees nothing until it has a row here. That is the right
 * default for everyone except the first person — hence this script, which exists to solve the
 * chicken-and-egg problem of needing an admin in order to create the first admin.
 *
 * Idempotent: anyone who already has a row is left exactly as they are, so re-running it will
 * not quietly promote a salesperson back to admin.
 *
 * Run with:  npm run db:bootstrap-admin
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to list Auth users.",
  );
}

if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface SupabaseAuthUser {
  id: string;
  email?: string;
}

async function main() {
  // The Admin API is the only way to read auth.users — it lives in the `auth` schema, which
  // Prisma does not manage.
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=200`, {
    headers: {
      apikey: serviceRoleKey as string,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase Admin API returned ${response.status} ${response.statusText}.`);
  }

  const body = (await response.json()) as { users?: SupabaseAuthUser[] };
  const authUsers = (body.users ?? []).filter((user) => Boolean(user.email));

  if (authUsers.length === 0) {
    console.log(
      "No Supabase Auth users found. Create one in the dashboard first (Authentication → Users → Add user, Auto Confirm ticked), then re-run this.",
    );
    return;
  }

  for (const authUser of authUsers) {
    const email = authUser.email!.toLowerCase();
    const existing = await prisma.teamMember.findUnique({ where: { email } });

    if (existing) {
      console.log(`= ${email} already on the team as ${existing.role}. Left alone.`);
      continue;
    }

    await prisma.teamMember.create({
      data: {
        email,
        authUserId: authUser.id,
        // Falls back to the local part of the address, which the person can correct later.
        name: email.split("@")[0],
        role: TeamRole.ADMIN,
      },
    });

    console.log(`+ ${email} added as ADMIN.`);
  }

  const adminCount = await prisma.teamMember.count({
    where: { role: TeamRole.ADMIN, isActive: true },
  });
  console.log(`\nActive admins: ${adminCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

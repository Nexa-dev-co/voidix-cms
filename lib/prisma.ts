import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requires an explicit driver adapter, which is convenient here: it means the
// runtime connection string is passed in code rather than read out of the schema, so the app
// can use Supabase's POOLED url (PgBouncer, 6543) while the CLI keeps using the direct one
// (see prisma.config.ts). Pointing migrations at the pooler is the classic way to get
// "prepared statement already exists" errors under load.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill in the Supabase connection strings.",
  );
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Next's dev server re-evaluates modules on every hot reload. Without this cache each reload
// would open a fresh pool and Supabase would start refusing connections after a few dozen edits.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

import "dotenv/config";
import { defineConfig } from "prisma/config";

// Supabase hands out two connection strings and they are not interchangeable.
//
//   DATABASE_URL — the pooled one (PgBouncer, port 6543). What the running app uses.
//   DIRECT_URL   — the direct one (port 5432). What migrations must use, because PgBouncer
//                  runs in transaction mode and cannot hold the advisory locks or the
//                  session state that DDL and shadow-database work need.
//
// This config file is only ever loaded by the Prisma CLI (migrate, db pull, studio), so it
// takes the direct URL. The runtime client is pointed at the pooled one in lib/prisma.ts.
// Falling back to DATABASE_URL keeps `prisma generate` working before anyone has filled in
// the second variable.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

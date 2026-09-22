import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { seedBlogArticles } from "../prisma/blogArticleSeed";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set to seed the blog articles.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

seedBlogArticles(prisma)
  .then((count) => console.log(`Seeded ${count} blog articles.`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

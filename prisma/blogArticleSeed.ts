import { readFile } from "node:fs/promises";

import type { PrismaClient } from "../generated/prisma/client";

export type BlogSeedArticle = {
  sourceArticle: number;
  slug: string;
  title: string;
  seoTitle: string;
  excerpt: string;
  category: string;
  publishedOn: string;
  body: {
    kind: "PARAGRAPH" | "HEADING_2" | "HEADING_3" | "LIST_ITEM";
    body: string;
  }[];
};

export async function loadBlogArticles(): Promise<BlogSeedArticle[]> {
  const source = await readFile(new URL("./data/blogArticles.json", import.meta.url), "utf8");
  return JSON.parse(source) as BlogSeedArticle[];
}

export async function seedBlogArticles(prisma: PrismaClient): Promise<number> {
  const articles = await loadBlogArticles();

  for (const article of articles) {
    const { sourceArticle, body, publishedOn, ...fields } = article;
    const data = {
      ...fields,
      sortOrder: sourceArticle - 1,
      publishedOn: new Date(`${publishedOn}T00:00:00Z`),
    };
    const record = await prisma.blogPost.upsert({
      where: { slug: article.slug },
      create: data,
      update: data,
    });

    await prisma.blogParagraph.deleteMany({ where: { blogPostId: record.id } });
    await prisma.blogParagraph.createMany({
      data: body.map((block, index) => ({
        blogPostId: record.id,
        sortOrder: index,
        kind: block.kind,
        body: block.body,
      })),
    });
  }

  return prisma.blogPost.count();
}

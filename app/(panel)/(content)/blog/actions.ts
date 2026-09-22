"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { planReorder, type MoveDirection } from "@/lib/content/reorder";
import { formError, formErrorFromZod, formSuccess, type FormState } from "@/lib/forms/formState";
import { prisma } from "@/lib/prisma";
import { makeSlugUnique, slugify } from "@/lib/text/slugify";
import { blogSchema } from "@/lib/validation/contentSchemas";

function revalidateBlog(id?: string) {
  revalidatePath("/");
  revalidatePath("/blog");
  if (id) revalidatePath(`/blog/${id}`);
}

function parseBlogForm(formData: FormData) {
  return blogSchema.safeParse({
    title: formData.get("title") ?? "",
    seoTitle: formData.get("seoTitle") ?? "",
    excerpt: formData.get("excerpt") ?? "",
    category: formData.get("category") ?? "",
    publishedOn: formData.get("publishedOn") ?? "",
    body: formData.get("body") ?? "",
  });
}

export async function createBlogAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = parseBlogForm(formData);
  if (!parsed.success) return formErrorFromZod(parsed.error);

  const { title, seoTitle, excerpt, category, publishedOn, body } = parsed.data;
  const [highestSortOrder, existingSlugs] = await Promise.all([
    prisma.blogPost.aggregate({ _max: { sortOrder: true } }),
    prisma.blogPost.findMany({ select: { slug: true } }),
  ]);
  const slug = makeSlugUnique(slugify(title), new Set(existingSlugs.map((post) => post.slug)));

  await prisma.blogPost.create({
    data: {
      slug,
      title,
      seoTitle,
      excerpt,
      category,
      publishedOn: new Date(`${publishedOn}T00:00:00Z`),
      sortOrder: (highestSortOrder._max.sortOrder ?? -1) + 1,
      paragraphs: {
        create: body.map((block, index) => ({ sortOrder: index, kind: block.kind, body: block.body })),
      },
    },
  });

  revalidateBlog();
  redirect("/blog");
}

export async function updateBlogAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return formError("Missing article id.");

  const parsed = parseBlogForm(formData);
  if (!parsed.success) return formErrorFromZod(parsed.error);

  const existing = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return formError("That article no longer exists.");

  const { title, seoTitle, excerpt, category, publishedOn, body } = parsed.data;
  await prisma.$transaction([
    prisma.blogPost.update({
      where: { id },
      data: { title, seoTitle, excerpt, category, publishedOn: new Date(`${publishedOn}T00:00:00Z`) },
    }),
    prisma.blogParagraph.deleteMany({ where: { blogPostId: id } }),
    prisma.blogParagraph.createMany({
      data: body.map((block, index) => ({
        blogPostId: id,
        sortOrder: index,
        kind: block.kind,
        body: block.body,
      })),
    }),
  ]);

  revalidateBlog(id);
  return formSuccess("Saved as a draft. Publish from the overview to push it live.");
}

export async function deleteBlogAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.blogPost.delete({ where: { id } });
  const remaining = await prisma.blogPost.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await prisma.$transaction(
    remaining.map((post, position) =>
      prisma.blogPost.update({ where: { id: post.id }, data: { sortOrder: position } }),
    ),
  );

  revalidateBlog();
  redirect("/blog");
}

export async function moveBlogAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "") as MoveDirection;
  if (!id || (direction !== "up" && direction !== "down")) return;

  const posts = await prisma.blogPost.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  const updates = planReorder(posts.map((post) => post.id), id, direction);
  if (!updates) return;

  await prisma.$transaction(
    updates.map((update) =>
      prisma.blogPost.update({ where: { id: update.id }, data: { sortOrder: update.sortOrder } }),
    ),
  );
  revalidateBlog();
}

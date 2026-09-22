import { notFound } from "next/navigation";

import { deleteBlogAction } from "@/app/(panel)/(content)/blog/actions";
import { BlogForm } from "@/app/(panel)/(content)/blog/BlogForm";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { serialiseBlogBlocks } from "@/lib/content/blogBlocks";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditBlogPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const post = await prisma.blogPost.findUnique({
    where: { id },
    include: { paragraphs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!post) notFound();

  return (
    <>
      <PageHeader eyebrow={`Article ${formatOrdinal(post.sortOrder)}`} title={post.title} />
      <BlogForm
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          seoTitle: post.seoTitle,
          excerpt: post.excerpt,
          category: post.category,
          publishedOn: post.publishedOn.toISOString().slice(0, 10),
          body: serialiseBlogBlocks(post.paragraphs),
        }}
      />
      <DangerZone
        id={post.id}
        deleteAction={deleteBlogAction}
        title="Delete this article"
        description="Removes it from the draft and renumbers the archive. The last published release keeps its copy until you publish again."
        confirmMessage={`Delete "${post.title}"? This can't be undone.`}
        buttonLabel="Delete article"
      />
    </>
  );
}

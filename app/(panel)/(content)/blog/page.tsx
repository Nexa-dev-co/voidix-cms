import Link from "next/link";

import { moveBlogAction } from "@/app/(panel)/(content)/blog/actions";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { sortOrder: "asc" },
    include: { paragraphs: { select: { id: true } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Section 08"
        title="Blog"
        description="The public field journal. The first article becomes the archive's lead signal; reorder deliberately."
        action={<ButtonLink href="/blog/new" variant="secondary">Add article</ButtonLink>}
      />

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {posts.map((post, position) => (
          <div key={post.id} className="flex items-start gap-3 py-5">
            <span className="shrink-0 pt-1 text-xs tabular-nums text-muted/60">
              {formatOrdinal(position)}
            </span>
            <Link href={`/blog/${post.id}`} className="group min-w-0 flex-1">
              <p className="text-sm text-fg transition-colors group-hover:text-accent">{post.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{post.excerpt}</p>
              <p className="mt-1.5 text-[11px] text-muted/60">
                {post.category} / {post.publishedOn.toISOString().slice(0, 10)} / {post.paragraphs.length} blocks
              </p>
            </Link>
            <ReorderControls
              id={post.id}
              isFirst={position === 0}
              isLast={position === posts.length - 1}
              moveAction={moveBlogAction}
              label={post.title}
            />
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <p className="py-8 text-sm text-muted">No articles yet. Add the first signal, then publish the release.</p>
      )}
    </>
  );
}

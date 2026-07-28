import Link from "next/link";

import { moveFaqAction } from "@/app/admin/faq/actions";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const entries = await prisma.faqEntry.findMany({
    orderBy: { sortOrder: "asc" },
    include: { paragraphs: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Section 03"
        title="FAQ"
        description="The questions the hologram answers. The freest section in the system — the hologram measures its own content, so length and count cost nothing."
        action={
          <ButtonLink href="/admin/faq/new" variant="secondary">
            Add question
          </ButtonLink>
        }
      />

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {entries.map((entry, position) => (
          <div key={entry.id} className="flex items-start gap-3 py-5">
            <span className="shrink-0 pt-1 text-xs tabular-nums text-muted/60">
              {formatOrdinal(position)}
            </span>

            <Link href={`/admin/faq/${entry.id}`} className="group min-w-0 flex-1">
              <p className="text-sm text-fg transition-colors group-hover:text-accent">
                {entry.question}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                {entry.paragraphs[0]?.body}
              </p>
              <p className="mt-1.5 text-[11px] text-muted/60">
                {entry.paragraphs.length} paragraph{entry.paragraphs.length === 1 ? "" : "s"}
              </p>
            </Link>

            <ReorderControls
              id={entry.id}
              isFirst={position === 0}
              isLast={position === entries.length - 1}
              moveAction={moveFaqAction}
              label={entry.question}
            />
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="py-8 text-sm text-muted">
          No questions yet. Add one, or run <code className="text-fg">npm run db:seed</code> to
          load the current site copy.
        </p>
      )}
    </>
  );
}

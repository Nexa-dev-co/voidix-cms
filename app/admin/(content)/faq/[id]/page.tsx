import { notFound } from "next/navigation";

import { deleteFaqAction } from "@/app/admin/(content)/faq/actions";
import { FaqForm } from "@/app/admin/(content)/faq/FaqForm";
import { DangerZone } from "@/components/ui/DangerZone";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { joinParagraphs } from "@/lib/text/plainText";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditFaqPage(props: PageProps<"/admin/faq/[id]">) {
  const { id } = await props.params;

  const entry = await prisma.faqEntry.findUnique({
    where: { id },
    include: { paragraphs: { orderBy: { sortOrder: "asc" } } },
  });

  if (!entry) {
    notFound();
  }

  return (
    <>
      <PageHeader eyebrow={`Question ${formatOrdinal(entry.sortOrder)}`} title={entry.question} />

      <FaqForm
        entry={{
          id: entry.id,
          question: entry.question,
          answer: joinParagraphs(entry.paragraphs.map((paragraph) => paragraph.body)),
        }}
      />

      <DangerZone
        id={entry.id}
        deleteAction={deleteFaqAction}
        title="Delete this question"
        description="Removes it from the draft along with its paragraphs, and renumbers the rest. The last published release keeps its own copy until you publish again."
        confirmMessage={`Delete "${entry.question}"? This can't be undone.`}
        buttonLabel="Delete question"
      />
    </>
  );
}

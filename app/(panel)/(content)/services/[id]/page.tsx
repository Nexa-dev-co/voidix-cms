import { notFound } from "next/navigation";

import { ServiceForm } from "@/app/(panel)/(content)/services/ServiceForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditServicePage(props: PageProps<"/services/[id]">) {
  const { id } = await props.params;

  const [service, disciplines] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: { capabilities: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.discipline.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!service) {
    notFound();
  }

  return (
    <>
      <PageHeader
        eyebrow={`Service ${formatOrdinal(service.sortOrder)}`}
        title={service.name}
        description="The ordinal, the vessel model, its hull palette and its lighting all stay in the site's source — this page owns the words only."
      />

      <ServiceForm
        service={{
          id: service.id,
          name: service.name,
          eyebrow: service.eyebrow,
          description: service.description,
          capabilities: service.capabilities.map((capability) => capability.label),
          disciplineId: service.disciplineId,
        }}
        disciplines={disciplines}
      />
    </>
  );
}

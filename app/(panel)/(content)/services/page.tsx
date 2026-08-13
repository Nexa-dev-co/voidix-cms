import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    orderBy: { sortOrder: "asc" },
    include: { capabilities: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Section 01"
        title="Services"
        description="The four vessels on the deck. Copy is editable; the order and the count are not — each service is bound to a 3D model and a placement that the site keys by position."
      />

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {services.map((service, position) => (
          <Link
            key={service.id}
            href={`/services/${service.id}`}
            className="group flex gap-4 py-5 transition-colors duration-150 hover:bg-card/50"
          >
            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted/60">
              {formatOrdinal(position)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg transition-colors group-hover:text-accent">
                {service.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{service.eyebrow}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {service.capabilities.map((capability) => (
                  <span
                    key={capability.id}
                    className="rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted"
                  >
                    {capability.label}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {services.length === 0 && (
        <p className="py-8 text-sm text-muted">
          No services yet. Run <code className="text-fg">npm run db:seed</code> to load the
          current site copy.
        </p>
      )}
    </>
  );
}

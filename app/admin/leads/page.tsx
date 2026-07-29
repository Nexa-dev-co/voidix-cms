import Link from "next/link";

import { LeadStatus } from "@/generated/prisma/enums";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { requireMember } from "@/lib/auth";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { buildContactVisibilityFilter } from "@/lib/leads/visibility";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "new", label: "New", status: LeadStatus.NEW },
  { key: "read", label: "Read", status: LeadStatus.READ },
  { key: "archived", label: "Archived", status: LeadStatus.ARCHIVED },
  { key: "all", label: "All", status: null },
] as const;

const OWNER_FILTERS = [
  { key: "everyone", label: "Everyone" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
] as const;

export default async function LeadsPage(props: PageProps<"/admin/leads">) {
  const member = await requireMember();
  const searchParams = await props.searchParams;

  const rawStatus = typeof searchParams.status === "string" ? searchParams.status : "new";
  const rawOwner = typeof searchParams.owner === "string" ? searchParams.owner : "everyone";
  const activeStatus = STATUS_FILTERS.find((f) => f.key === rawStatus) ?? STATUS_FILTERS[0];
  const activeOwner = OWNER_FILTERS.find((f) => f.key === rawOwner) ?? OWNER_FILTERS[0];

  // Everything a salesperson may see at all. The owner tabs narrow within this, never past it.
  const visibilityFilter = await buildContactVisibilityFilter(member);

  const ownerCondition: Prisma.ContactWhereInput =
    activeOwner.key === "mine"
      ? { assignedToId: member.id }
      : activeOwner.key === "unassigned"
        ? { assignedToId: null }
        : {};

  const scopedCondition: Prisma.ContactWhereInput = { AND: [visibilityFilter, ownerCondition] };

  const where: Prisma.ContactWhereInput = {
    AND: [scopedCondition, activeStatus.status ? { status: activeStatus.status } : {}],
  };

  // A salesperson who can only see their own leads has nothing to filter by owner, so the
  // tabs would be three ways of saying the same thing.
  const settings = await getLeadSettings();
  const visibleOwnerFilters =
    member.role === "ADMIN"
      ? OWNER_FILTERS
      : settings.salesCanClaimUnassigned
        ? OWNER_FILTERS.filter((filter) => filter.key !== "everyone")
        : [];

  const [contacts, statusCounts, isIntakeConfigured] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        assignedTo: { select: { name: true } },
        _count: { select: { enquiries: true } },
      },
    }),
    prisma.contact.groupBy({
      by: ["status"],
      where: scopedCondition,
      _count: { _all: true },
    }),
    Promise.resolve(Boolean(process.env.LEADS_INTAKE_SECRET)),
  ]);

  const countByStatus = new Map(statusCounts.map((row) => [row.status, row._count._all]));
  const totalCount = statusCounts.reduce((total, row) => total + row._count._all, 0);

  const buildHref = (statusKey: string, ownerKey: string) =>
    `/admin/leads?status=${statusKey}&owner=${ownerKey}`;

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Leads"
        description="One row per person. Everything they've sent or been imported in sits under them as history."
        action={
          <div className="flex gap-2">
            <ButtonLink href="/admin/leads/import" variant="secondary">
              Import
            </ButtonLink>
            <ButtonLink href="/admin/leads/new" variant="primary">
              Add lead
            </ButtonLink>
          </div>
        }
      />

      {!isIntakeConfigured && (
        <PageHeaderNote>
          The website form intake is switched off —{" "}
          <code className="text-fg">LEADS_INTAKE_SECRET</code> is not set, so{" "}
          <code className="text-fg">POST /api/leads</code> rejects everything. Adding and
          importing leads here still works.
        </PageHeaderNote>
      )}

      <nav className="mb-2 flex flex-wrap gap-1">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.key === activeStatus.key;
          const count = filter.status ? (countByStatus.get(filter.status) ?? 0) : totalCount;

          return (
            <Link
              key={filter.key}
              href={buildHref(filter.key, activeOwner.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs transition-colors duration-150 ${
                isActive ? "bg-card text-fg" : "text-muted hover:bg-card/60 hover:text-fg"
              }`}
            >
              {filter.label}
              <span className={`tabular-nums ${isActive ? "text-accent" : "text-muted/60"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav className="mb-6 flex flex-wrap gap-1">
        {visibleOwnerFilters.map((filter) => {
          const isActive = filter.key === activeOwner.key;

          return (
            <Link
              key={filter.key}
              href={buildHref(activeStatus.key, filter.key)}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-sm px-3 py-1 text-[11px] transition-colors duration-150 ${
                isActive
                  ? "border border-accent/40 text-accent"
                  : "border border-transparent text-muted hover:text-fg"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col divide-y divide-border border-y border-border">
        {contacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/admin/leads/${contact.id}`}
            className="group flex items-start gap-3 py-4 transition-colors duration-150 hover:bg-card/50"
          >
            <span
              aria-hidden
              className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                contact.status === LeadStatus.NEW ? "bg-accent" : "bg-transparent"
              }`}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {contact.name}
                </p>
                <p className="text-xs text-muted">{contact.email}</p>
              </div>

              <p className="mt-0.5 text-xs text-muted">
                {[contact.company, contact.phone].filter(Boolean).join(" · ") || "—"}
              </p>

              <p className="mt-1.5 text-[11px] text-muted/60">
                {contact._count.enquiries} touchpoint
                {contact._count.enquiries === 1 ? "" : "s"}
                {contact.assignedTo ? ` · ${contact.assignedTo.name}` : " · unassigned"}
              </p>
            </div>

            <time
              dateTime={contact.createdAt.toISOString()}
              className="shrink-0 text-[11px] text-muted/60"
            >
              {contact.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </time>
          </Link>
        ))}
      </div>

      {contacts.length === 0 && (
        <p className="py-8 text-sm text-muted">
          {totalCount === 0
            ? "No leads yet. Add one by hand, import a spreadsheet, or wait for the site's form."
            : `Nothing here with these filters.`}
        </p>
      )}
    </>
  );
}

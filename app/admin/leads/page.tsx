import Link from "next/link";

import { LeadsTable, type LeadColumn } from "@/app/admin/leads/LeadsTable";
import { LeadsSearch } from "@/app/admin/leads/LeadsSearch";
import { SourceFilter } from "@/app/admin/leads/SourceFilter";
import type { BulkTarget } from "@/app/admin/leads/BulkActionBar";
import { TeamRole } from "@/generated/prisma/enums";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { requireMember } from "@/lib/auth";
import { getActiveFieldDefinitions } from "@/lib/leads/customFields";
import { listImportBatchOptions, queryLeads } from "@/lib/leads/leadQuery";
import {
  buildLeadsHref,
  parseLeadQueryParams,
  PAGE_SIZE_OPTIONS,
  type LeadQueryParams,
} from "@/lib/leads/leadsView";
import { getLeadSettings } from "@/lib/leads/leadSettings";
import { getActiveStages, getSelectableStages } from "@/lib/leads/pipeline";
import { parseColumnLayout, resolveColumns, visibleColumns } from "@/lib/leads/tableColumns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OWNER_FILTERS = [
  { key: "everyone", label: "Everyone" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
] as const;

export default async function LeadsPage(props: PageProps<"/admin/leads">) {
  const member = await requireMember();
  const searchParams = await props.searchParams;
  const params = parseLeadQueryParams(searchParams);

  const [result, stages, selectableStages, settings, definitions, importBatches] =
    await Promise.all([
      queryLeads(member, params),
      getActiveStages(),
      getSelectableStages(member),
      getLeadSettings(),
      getActiveFieldDefinitions(),
      listImportBatchOptions(member),
    ]);

  const teamMembers =
    member.role === TeamRole.ADMIN
      ? await prisma.teamMember.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const columns = visibleColumns(
    resolveColumns(parseColumnLayout(settings.leadsTableColumns), definitions),
  );

  // Flattened here rather than in the client: ResolvedColumn carries the whole field definition,
  // and only the handful of fields the table actually renders should cross the boundary.
  const tableColumns: LeadColumn[] = columns.map((column) => ({
    key: column.key,
    label: column.label,
    width: column.width,
    sortKey: column.sortKey,
    customCellIndex: column.definition
      ? definitions.findIndex((definition) => definition.id === column.definition?.id)
      : null,
    builtinId: column.builtin?.id ?? null,
    isLocked: column.isLocked,
  }));

  const bulkTarget: BulkTarget = {
    stages: selectableStages.map((stage) => ({ id: stage.id, label: stage.label })),
    members: teamMembers,
    canAssign: member.role === TeamRole.ADMIN,
    showingArchived: params.showArchived,
  };

  // A salesperson who can only ever see their own leads has nothing to filter by owner, so the
  // tabs would be three ways of saying the same thing.
  const visibleOwnerFilters =
    member.role === TeamRole.ADMIN
      ? OWNER_FILTERS
      : settings.salesCanClaimUnassigned
        ? OWNER_FILTERS.filter((filter) => filter.key !== "everyone")
        : [];

  const isIntakeConfigured = Boolean(process.env.LEADS_INTAKE_SECRET);
  const countByStage = new Map(result.stageCounts.map((row) => [row.stageId, row.count]));
  const openCount = stages
    .filter((stage) => stage.kind === "OPEN")
    .reduce((total, stage) => total + (countByStage.get(stage.id) ?? 0), 0);
  // Everything not archived. Summed from the per-stage counts rather than queried again, and it
  // includes stages that have since been retired but still hold leads.
  const activeCount = result.stageCounts.reduce((total, row) => total + row.count, 0);

  // The stage row and the follow-up row are one selection between them: landing on "Overdue"
  // must not leave "All" looking selected too.
  const isStageTabActive = params.due === "any" && !params.showArchived;

  return (
    // Ordinary flow: the page scrolls, the table is as tall as its rows, and the column headings
    // stick to the top of the window on the way down. The shell is what scrolls on desktop, which
    // is also what keeps the sidebar in place.
    <>
      <div>
        <PageHeader
          eyebrow="Pipeline"
          title="Leads"
          // Kept to one line on purpose. At the old length it wrapped to two, and forty pixels of
          // explanation you have read a hundred times is forty pixels of leads you cannot see.
          description="One row per person. Everything they've sent sits under them as history."
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
            <code className="text-fg">POST /api/leads</code> rejects everything. Adding and importing
            leads here still works.
          </PageHeaderNote>
        )}

        {/* One row of stages, then one row for everything else. The first version stacked three
            navs — stage, follow-up, owner — which put sixteen controls between the page heading
            and the first lead, most of them reading zero. */}
        <nav aria-label="Stage" className="mb-2.5 flex flex-wrap items-center gap-1 border-b border-border pb-2.5">
          <FilterTab
            href={buildLeadsHref(params, { stage: "all", due: "any", showArchived: false })}
            label="All"
            count={activeCount}
            isActive={isStageTabActive && params.stage === "all"}
          />
          <FilterTab
            href={buildLeadsHref(params, { stage: "open", due: "any", showArchived: false })}
            label="Open"
            count={openCount}
            isActive={isStageTabActive && params.stage === "open"}
          />

          <span aria-hidden className="mx-1 h-4 w-px bg-border" />

          {stages.map((stage) => {
            const count = countByStage.get(stage.id) ?? 0;

            // An empty stage stays reachable but stops competing for attention — a pipeline with
            // four zeroes in it shouldn't look like four things needing work.
            return (
              <FilterTab
                key={stage.id}
                href={buildLeadsHref(params, { stage: stage.id, due: "any", showArchived: false })}
                label={stage.label}
                count={count}
                isActive={isStageTabActive && params.stage === stage.id}
                isEmpty={count === 0}
              />
            );
          })}
        </nav>

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-1">
            <FilterTab
              href={buildLeadsHref(params, { due: "today", stage: "all", showArchived: false })}
              label="Due today"
              count={result.dueTodayCount}
              isActive={params.due === "today"}
              isEmpty={result.dueTodayCount === 0}
            />
            <FilterTab
              href={buildLeadsHref(params, { due: "overdue", stage: "all", showArchived: false })}
              label="Overdue"
              count={result.overdueCount}
              isActive={params.due === "overdue"}
              isEmpty={result.overdueCount === 0}
              tone={result.overdueCount > 0 ? "danger" : undefined}
            />
            <FilterTab
              href={buildLeadsHref(params, { showArchived: true, stage: "all", due: "any" })}
              label="Archived"
              count={result.archivedCount}
              isActive={params.showArchived}
              isEmpty={result.archivedCount === 0}
            />

            {visibleOwnerFilters.length > 0 && (
              <>
                <span aria-hidden className="mx-1 h-4 w-px bg-border" />
                {visibleOwnerFilters.map((filter) => {
                  const isActive = filter.key === params.owner;

                  return (
                    <Link
                      key={filter.key}
                      href={buildLeadsHref(params, { owner: filter.key })}
                      aria-current={isActive ? "page" : undefined}
                      className={`rounded-sm px-2.5 py-1.5 text-xs transition-colors duration-150 ${
                        isActive ? "text-accent" : "text-muted hover:text-fg"
                      }`}
                    >
                      {filter.label}
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SourceFilter params={params} batches={importBatches} />
            <LeadsSearch params={params} />
          </div>
        </div>
      </div>

      {result.rows.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm text-fg">
            {result.totalCount === 0 && params.search.length === 0
              ? "No leads here yet."
              : "Nothing matches these filters."}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
            {result.totalCount === 0 && params.search.length === 0
              ? "Add one by hand, import a spreadsheet, or wait for the site's form."
              : "Try a different stage, another source, a wider owner filter, or clear the search."}
          </p>
        </div>
      ) : (
        <LeadsTable
          rows={result.rows}
          columns={tableColumns}
          params={params}
          bulkTarget={bulkTarget}
          canResize={member.role === TeamRole.ADMIN}
        />
      )}

      {/* Always rendered, not just when there is more than one page. The row count is the answer
          to "how many is that?" — the question a filtered list raises most — and hiding it until
          the list happens to overflow one page is exactly when it is least needed. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-xs text-muted">
        <span className="tabular-nums">
          {result.totalCount} {result.totalCount === 1 ? "lead" : "leads"}
          {result.pageCount > 1 && ` · page ${params.page} of ${result.pageCount}`}
        </span>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PageSizePicker params={params} />

          {result.pageCount > 1 && (
            <div className="flex gap-2">
              {params.page > 1 && (
                <Link
                  href={buildLeadsHref(params, { page: params.page - 1 })}
                  className="rounded-sm border border-border-strong px-3 py-1 transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  Previous
                </Link>
              )}
              {params.page < result.pageCount && (
                <Link
                  href={buildLeadsHref(params, { page: params.page + 1 })}
                  className="rounded-sm border border-border-strong px-3 py-1 transition-colors duration-150 hover:border-accent hover:text-accent"
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * How many rows a page holds.
 *
 * The URL has always accepted `size` and `parseLeadQueryParams` has always bounded it, but
 * nothing on screen offered it — so the one control that decides how much scrolling the table
 * costs you was reachable only by editing the address bar.
 */
function PageSizePicker({ params }: { params: LeadQueryParams }) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-muted/60">Rows</span>
      {PAGE_SIZE_OPTIONS.map((size) => {
        const isActive = size === params.pageSize;

        return (
          <Link
            key={size}
            href={buildLeadsHref(params, { pageSize: size })}
            aria-current={isActive ? "true" : undefined}
            className={`rounded-sm px-1.5 py-0.5 tabular-nums transition-colors duration-150 ${
              isActive ? "bg-card text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {size}
          </Link>
        );
      })}
    </div>
  );
}

function FilterTab({
  href,
  label,
  count,
  isActive,
  isEmpty = false,
  tone,
}: {
  href: string;
  label: string;
  count?: number;
  isActive: boolean;
  /** Reachable, but dimmed — a tab reading zero shouldn't pull the eye like one reading nine. */
  isEmpty?: boolean;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs transition-colors duration-150 ${
        isActive
          ? "bg-card text-fg"
          : isEmpty
            ? "text-muted/50 hover:bg-card/50 hover:text-fg"
            : "text-muted hover:bg-card/50 hover:text-fg"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`tabular-nums ${
            tone === "danger" && count > 0
              ? "text-danger"
              : isActive
                ? "text-accent"
                : isEmpty
                  ? "text-muted/40"
                  : "text-muted/70"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

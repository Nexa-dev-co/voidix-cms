"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BulkActionBar, type BulkTarget } from "@/app/(panel)/leads/BulkActionBar";
import { LeadCards } from "@/app/(panel)/leads/LeadCards";
import { saveColumnWidthAction } from "@/app/(panel)/settings/actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/Table";
import { cn } from "@/lib/classNames";
import { ORIGIN_TONES } from "@/lib/leads/leadOrigin";
import {
  buildLeadsHref,
  STAGE_TONES,
  type LeadQueryParams,
  type LeadRow,
} from "@/lib/leads/leadsView";
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH } from "@/lib/leads/tableColumns";

/**
 * The width of the selection column, in pixels.
 *
 * A real number rather than a Tailwind class because the pinned Name column offsets itself by
 * exactly this much. When the two were expressed separately — `w-10` on one, `left-10` on the
 * other — a cell's browser-computed width drifted from the class, and Name ended up rendering
 * *inside* the checkbox column with the next column's text bleeding through it.
 */
const SELECT_COLUMN_WIDTH = 44;

/**
 * Anything inside a row that answers a click for itself.
 *
 * The row navigates to the lead, but the checkbox, the mailto and the tel links each mean
 * something different — navigating on top of them would make selecting a lead impossible and
 * turn every phone number into a page change.
 */
const INTERACTIVE_WITHIN_ROW = "a, button, input, label, [role='checkbox']";

/** Serialisable shape of a resolved column — `ResolvedColumn` carries server-only objects. */
export interface LeadColumn {
  key: string;
  label: string;
  width: number;
  sortKey: string | null;
  /** Index into `LeadRow.customCells`, or null for a builtin column. */
  customCellIndex: number | null;
  builtinId: string | null;
  /** Name, which is pinned to the left edge while the rest of the columns scroll past it. */
  isLocked: boolean;
}

export function LeadsTable({
  rows,
  columns,
  params,
  bulkTarget,
  canResize,
}: {
  rows: LeadRow[];
  columns: LeadColumn[];
  params: LeadQueryParams;
  bulkTarget: BulkTarget;
  canResize: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // A new page of rows makes the old selection meaningless — keeping it would leave a bulk action
  // pointed at leads that are no longer on screen.
  const rowSignature = rows.map((row) => row.id).join(",");
  useEffect(() => {
    setSelectedIds([]);
  }, [rowSignature]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allOnPageSelected = rows.length > 0 && selectedIds.length === rows.length;
  const someOnPageSelected = selectedIds.length > 0 && !allOnPageSelected;

  // `table-fixed` needs a total to lay out against. Below this the table fills its container and
  // columns share the slack; above it, the columns hold the widths the admin set and the table
  // grows past the window, which the page then scrolls sideways to reach.
  const totalWidth = useMemo(
    () => columns.reduce((total, column) => total + column.width, SELECT_COLUMN_WIDTH),
    [columns],
  );

  const tableColumns = useMemo<ColumnDef<LeadRow>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        size: column.width,
        header: () => column.label,
        cell: ({ row }) => renderCell(column, row.original),
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    // Everything happens in the database. TanStack is the rendering and column model here, not
    // the data engine — see lib/leads/leadQuery.ts for why.
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  // Looked up by the column's own id rather than by position. The two arrays happen to line up
  // today, but a lookup that silently mislabels every cell if that ever stops being true is not
  // a bug you would notice from the screen — the values would simply be under the wrong headings.
  const columnByKey = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns],
  );

  const toggleSelected = (leadId: string, isSelected: boolean) => {
    setSelectedIds((current) =>
      isSelected ? [...current, leadId] : current.filter((id) => id !== leadId),
    );
  };

  const openLead = (event: React.MouseEvent, leadId: string) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_ROW)) {
      return;
    }

    // Selecting a phone number to copy it is not a request to leave the page.
    if (window.getSelection()?.toString()) {
      return;
    }

    const href = `/leads/${leadId}`;

    // Ctrl/⌘-click and middle-click open a new tab everywhere else on the web, and a row that
    // swallowed them would be the one link on the page that doesn't.
    if (event.ctrlKey || event.metaKey || event.button === 1) {
      window.open(href, "_blank", "noopener");
      return;
    }

    router.push(href);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <BulkActionBar
        selectedIds={selectedIds}
        target={bulkTarget}
        onCleared={() => setSelectedIds([])}
      />

      {/* Below `sm` the same rows render as cards instead — see LeadCards for why. Selection is
          held here rather than in either layout, so ticking a lead means the same thing to the
          bulk bar whichever one you are looking at. */}
      <div className="sm:hidden">
        <LeadCards rows={rows} selectedIds={selectedSet} onToggle={toggleSelected} />
      </div>

      {/* Sideways only. Vertically the box is exactly as tall as its rows — five leads are five
          rows, never a box half full of nothing — and the page is what scrolls down.

          `overflow-y-hidden` rather than letting it default to `auto`: a horizontal scrollbar
          eats ~15px inside the box, which pushes the last row past the bottom edge and summons a
          *vertical* scrollbar to reveal 15px of nothing. Nothing is clipped by hiding it, because
          the box is already as tall as its content.

          Owning the horizontal scroll is what keeps the page still. Without it the overflow falls
          to the content column, and reaching the last column drags the heading, the tabs and the
          search box off to the left with it. The cost, paid knowingly: `position: sticky`
          resolves against the nearest scrollport, so the column headings can no longer stick to
          the window — they belong to this box now, and scroll away with the page. */}
      <div
        onScroll={(event) => setIsScrolled(event.currentTarget.scrollLeft > 0)}
        className="hidden overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-sm border border-border sm:block"
      >
        <Table className="w-full table-fixed text-xs" style={{ minWidth: totalWidth }}>
          {/* An explicit colgroup is what makes `table-fixed` honour these widths. Without it the
              browser sizes columns from their content and every width here is a suggestion. */}
          <colgroup>
            <col style={{ width: SELECT_COLUMN_WIDTH }} />
            {columns.map((column) => (
              <col key={column.key} style={{ width: column.width }} />
            ))}
          </colgroup>

          {/* Sticky lives on the cells, not on the row — `position: sticky` on a `<tr>` is not
              reliable across browsers. Header pinned cells (30) sit over body pinned cells (20). */}
          <thead>
            {/* The background lives on the row so the pinned cells can inherit it — that is what
                keeps the seam continuous instead of striping. */}
            <tr className="border-b border-border bg-card">
              <th
                scope="col"
                className={cn(
                  "sticky left-0 z-30 bg-inherit px-3 py-2 text-left align-middle",
                  isScrolled &&
                    "after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-border-strong",
                )}
              >
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                  aria-label="Select every lead on this page"
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked === true ? rows.map((row) => row.id) : [])
                  }
                />
              </th>

              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const column = columnByKey.get(header.column.id);

                if (!column) {
                  return null;
                }

                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      "group/head relative bg-inherit px-3 py-2 text-left align-middle font-normal",
                      // Name stays put while the rest scrolls sideways — the point of a table
                      // that can grow custom columns past the edge of the screen.
                      column.isLocked && "sticky z-30",
                      column.isLocked &&
                        isScrolled &&
                        "after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-border-strong",
                    )}
                    style={column.isLocked ? { left: SELECT_COLUMN_WIDTH } : undefined}
                  >
                    <SortableHeader column={column} params={params} />
                    {canResize && (
                      <ColumnResizer
                        columnKey={column.key}
                        width={column.width}
                        onCommitted={() => router.refresh()}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const lead = row.original;
              const isSelected = selectedSet.has(lead.id);

              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  onClick={(event) => openLead(event, lead.id)}
                  onAuxClick={(event) => {
                    if (event.button === 1) {
                      openLead(event, lead.id);
                    }
                  }}
                  // The row is a mouse shortcut, not the only way in: the name is a real link, so
                  // it is still what a keyboard reaches and what a screen reader announces.
                  // Making the row itself focusable would put a second, unlabelled stop on every
                  // line of the table.
                  //
                  // Three opaque steps — page, hover, selected — so the row under the cursor and
                  // the rows you have ticked stay told apart at a glance.
                  className="cursor-pointer border-border bg-bg transition-colors duration-150 hover:bg-surface-hover data-[state=selected]:bg-card"
                >
                  <TableCell
                    className={cn(
                      "sticky left-0 z-20 bg-inherit px-3 py-1.5",
                      isScrolled &&
                        "after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-border-strong",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      aria-label={`Select ${lead.name}`}
                      onCheckedChange={(checked) => toggleSelected(lead.id, checked === true)}
                    />
                  </TableCell>

                  {row.getVisibleCells().map((cell) => {
                    const column = columnByKey.get(cell.column.id);

                    if (!column) {
                      return null;
                    }

                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "truncate bg-inherit px-3 py-1.5",
                          column.isLocked && "sticky z-20",
                          column.isLocked &&
                            isScrolled &&
                            "after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-border-strong",
                        )}
                        style={column.isLocked ? { left: SELECT_COLUMN_WIDTH } : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortableHeader({ column, params }: { column: LeadColumn; params: LeadQueryParams }) {
  const label = (
    <span className="truncate text-[10px] uppercase tracking-[0.12em]">{column.label}</span>
  );

  if (!column.sortKey) {
    return <span className="flex text-muted">{label}</span>;
  }

  const isSorted = params.sort === column.sortKey;
  const nextDirection: "asc" | "desc" = isSorted && params.direction === "asc" ? "desc" : "asc";

  return (
    <Link
      href={buildLeadsHref(params, { sort: column.sortKey, direction: nextDirection })}
      className={cn(
        "flex items-center gap-1.5 transition-colors duration-150",
        isSorted ? "text-accent" : "text-muted hover:text-fg",
      )}
    >
      {label}
      {isSorted ? (
        params.direction === "asc" ? (
          <ArrowUp className="size-3 shrink-0" />
        ) : (
          <ArrowDown className="size-3 shrink-0" />
        )
      ) : (
        // Hidden until the column is hovered: eight permanent sort glyphs is noise on a table
        // whose job is to be read, not operated.
        <ChevronsUpDown className="size-3 shrink-0 opacity-0 transition-opacity duration-150 group-hover/head:opacity-40" />
      )}
    </Link>
  );
}

/**
 * The drag handle on a column edge.
 *
 * Width is committed on release rather than on every mouse move — the layout lives in the
 * database and is shared by the whole team, so a drag across 300 pixels must not be 300 writes.
 */
function ColumnResizer({
  columnKey,
  width,
  onCommitted,
}: {
  columnKey: string;
  width: number;
  onCommitted: () => void;
}) {
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const startRef = useRef({ x: 0, width });

  useEffect(() => {
    if (dragWidth === null) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - startRef.current.x;
      setDragWidth(
        Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startRef.current.width + delta)),
      );
    };

    const handleUp = () => {
      const finalWidth = dragWidth;
      setDragWidth(null);

      if (finalWidth === null || finalWidth === width) {
        return;
      }

      const formData = new FormData();
      formData.set("key", columnKey);
      formData.set("width", String(finalWidth));
      void saveColumnWidthAction(formData).then(onCommitted);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragWidth, columnKey, width, onCommitted]);

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onPointerDown={(event) => {
        event.preventDefault();
        startRef.current = { x: event.clientX, width };
        setDragWidth(width);
      }}
      className={cn(
        "absolute top-1/2 right-0 z-10 h-5 w-1 -translate-y-1/2 cursor-col-resize touch-none rounded-full transition-colors duration-150",
        dragWidth === null ? "bg-transparent group-hover/head:bg-border-strong" : "bg-accent",
      )}
    />
  );
}

function renderCell(column: LeadColumn, lead: LeadRow) {
  if (column.customCellIndex !== null) {
    const cell = lead.customCells[column.customCellIndex];

    return cell?.isSet ? (
      <span title={cell.display} className="text-fg">
        {cell.display}
      </span>
    ) : (
      <Empty />
    );
  }

  switch (column.builtinId) {
    case "name":
      return (
        <Link
          href={`/leads/${lead.id}`}
          title={lead.name}
          // min-w-0 is what lets the name truncate: without it the flex item takes its content
          // width and pushes out of the fixed cell instead of ellipsing.
          className="flex min-w-0 items-center gap-2 text-fg underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
        >
          {lead.isOverdue && (
            <span
              aria-hidden
              title="Follow-up overdue"
              className="size-1.5 shrink-0 rounded-full bg-danger"
            />
          )}
          <span className="truncate">{lead.name}</span>
        </Link>
      );

    case "email":
      return (
        <a
          href={`mailto:${lead.email}`}
          title={lead.email}
          className="block truncate text-muted transition-colors duration-150 hover:text-accent"
        >
          {lead.email}
        </a>
      );

    case "company":
      return lead.company ? (
        <span title={lead.company} className="text-fg">
          {lead.company}
        </span>
      ) : (
        <Empty />
      );

    case "phone":
      return lead.phone ? (
        <a
          href={`tel:${lead.phone}`}
          className="text-muted transition-colors duration-150 hover:text-accent"
        >
          {lead.phone}
        </a>
      ) : (
        <Empty />
      );

    case "stage":
      return (
        <span
          className={cn(
            "inline-block max-w-full truncate rounded-sm border px-1.5 py-0.5 text-[11px] leading-4",
            STAGE_TONES[lead.stageKind] ?? STAGE_TONES.OPEN,
          )}
        >
          {lead.stageLabel}
        </span>
      );

    case "source":
      return (
        <span
          // The spreadsheet or campaign sits in the hover text rather than the cell: it is the
          // detail you want on the one row you are investigating, not on all fifty at once.
          title={lead.sourceDetail ? `${lead.sourceLabel} · ${lead.sourceDetail}` : lead.sourceLabel}
          className={cn(
            "inline-block max-w-full truncate rounded-sm border px-1.5 py-0.5 text-[11px] leading-4",
            ORIGIN_TONES[lead.sourceChannel],
          )}
        >
          {lead.sourceLabel}
        </span>
      );

    case "addedBy":
      return lead.addedByName ? (
        <span title={lead.addedByName} className="text-muted">
          {lead.addedByName}
        </span>
      ) : (
        <Empty />
      );

    case "owner":
      return lead.ownerName ? (
        <span title={lead.ownerName} className="text-muted">
          {lead.ownerName}
        </span>
      ) : (
        <span className="text-muted/50">Unassigned</span>
      );

    case "nextFollowUp":
      if (!lead.nextFollowUpAt) {
        return <Empty />;
      }
      return (
        <time
          dateTime={lead.nextFollowUpAt}
          className={lead.isOverdue ? "text-danger" : "text-muted"}
        >
          {formatDate(lead.nextFollowUpAt)}
        </time>
      );

    case "lastAttempt":
      return lead.lastAttemptSummary ? (
        <span
          className="text-muted"
          title={`${lead.lastAttemptSummary} · ${formatDate(lead.lastAttemptAt)}`}
        >
          {lead.lastAttemptSummary}
        </span>
      ) : (
        <span className="text-muted/50">Never</span>
      );

    case "touchpoints":
      return <span className="tabular-nums text-muted">{lead.touchpointCount}</span>;

    case "createdAt":
      return (
        <time dateTime={lead.createdAt} className="text-muted">
          {formatDate(lead.createdAt)}
        </time>
      );

    default:
      return null;
  }
}

/** One consistent glyph for "nothing recorded", so blank cells read as deliberate. */
function Empty() {
  return (
    <span aria-hidden className="text-muted/40">
      —
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const isThisYear = date.getFullYear() === new Date().getFullYear();

  // The year is noise on a list that is mostly recent; it earns its place only when the date
  // isn't from this year.
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(isThisYear ? {} : { year: "numeric" }),
  });
}

"use client";

import { Children, useState, type ReactNode } from "react";

/**
 * A list that shows its first few rows and offers the rest behind one control.
 *
 * ── ⚠ WHY THIS IS A CLIENT COMPONENT WHEN SO LITTLE ELSE HERE IS ───────────────────────────────
 * The user-activity pages are deliberately server-rendered — `CursorHeatmap` is 576 divs with no
 * JavaScript, and every filter on this feature is an anchor rather than a handler. Expanding a list
 * is different in kind: it is transient view state that nobody wants in their URL, nobody wants in
 * their history, and nobody wants a server round trip for. A `?expand=friction` parameter would
 * survive a bookmark and a back button, which is exactly wrong for "I glanced at the rest".
 *
 * ⚠ The CSS-only version — a hidden checkbox and `peer-checked:` sibling rules — was considered and
 * rejected. It cannot express the toggle's own label changing, and inside a `<table>` it forces the
 * checkbox out of the element it controls, which leaves markup nobody can read six months later.
 *
 * ── ⚠ THE ROWS ARE STILL RENDERED ON THE SERVER ────────────────────────────────────────────────
 * `children` arrives as an already-rendered payload; this component only decides how many of them to
 * mount. So the hidden rows cost no query, no fetch and no client-side formatting — the whole list
 * was built once, server-side, and the button just stops truncating it.
 */

/** Five, because that is the point at which a card stops being glanceable and starts being a table. */
const DEFAULT_LIMIT = 5;

type RowContainer = "div" | "ul" | "tbody";

export function ExpandableRows({
  children,
  as = "div",
  limit = DEFAULT_LIMIT,
  colSpan,
  label,
  className,
}: {
  children: ReactNode;
  /**
   * ⚠ `tbody` changes where the control goes. A `<button>` cannot be a sibling of `<tr>`, so inside a
   * table the toggle is rendered as a full-width row; everywhere else it sits after the container.
   * Getting this wrong produces markup the browser silently reparents, which moves the button out of
   * the table and breaks the layout in a way that looks like a CSS bug.
   */
  as?: RowContainer;
  limit?: number;
  /** Required when `as` is `tbody` — the toggle row has to span the whole table. */
  colSpan?: number;
  /** Plural noun for the control: "elements", "questions", "sections". */
  label: string;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ⚠ `Children.toArray` and not `children as ReactNode[]`: the caller passes the output of a `.map`,
  // which is one array child rather than N children, and it flattens fragments and holes as well.
  const rows = Children.toArray(children);
  const isTruncated = rows.length > limit;
  const visible = isExpanded || !isTruncated ? rows : rows.slice(0, limit);

  const toggle = isTruncated ? (
    <button
      type="button"
      onClick={() => setIsExpanded((current) => !current)}
      aria-expanded={isExpanded}
      className="text-[11px] text-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
    >
      {isExpanded ? "Show fewer" : `Show all ${rows.length} ${label}`}
    </button>
  ) : null;

  if (as === "tbody") {
    return (
      <tbody className={className}>
        {visible}
        {toggle && (
          <tr className="border-t border-border">
            <td colSpan={colSpan} className="px-4 py-2">
              {toggle}
            </td>
          </tr>
        )}
      </tbody>
    );
  }

  const Container = as;

  return (
    <>
      <Container className={className}>{visible}</Container>
      {/* ⚠ Outside the container, not inside it: the container carries the list's own grid or gap, so
          a button in there would be laid out as another row and inherit spacing meant for data. */}
      {toggle && <div className="mt-1">{toggle}</div>}
    </>
  );
}

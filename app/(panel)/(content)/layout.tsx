import ReadingColumn from "@/components/layout/ReadingColumn";
import { requireAdmin } from "@/lib/auth";

/**
 * Admin-only wrapper around every site-copy section.
 *
 * The route group exists purely for this guard. Neither group above it adds anything to the
 * URL — `(panel)/(content)/works` is served at `/works` — so nesting one inside the other
 * costs nothing and keeps the two different guards separate: `(panel)` admits any team
 * member, `(content)` narrows that to admins. Putting the check here rather than repeating it
 * in each page means a section added later inherits it by default instead of by memory.
 *
 * This protects the *pages*. It does not protect the Server Actions those pages call, which
 * are separate POST endpoints — each one calls `requireAdmin()` for itself.
 *
 * Every section here is prose being edited, so the whole group takes the reading width.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <ReadingColumn>{children}</ReadingColumn>;
}

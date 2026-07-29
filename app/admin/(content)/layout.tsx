import { requireAdmin } from "@/lib/auth";

/**
 * Admin-only wrapper around every site-copy section.
 *
 * The route group exists purely for this guard — `(content)` adds nothing to the URL, so
 * `/admin/works` is still `/admin/works`. Putting the check here rather than repeating it in
 * each page means a section added later inherits it by default instead of by memory.
 *
 * This protects the *pages*. It does not protect the Server Actions those pages call, which
 * are separate POST endpoints — each one calls `requireAdmin()` for itself.
 */
export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <>{children}</>;
}

import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A standing caveat about something the CMS can't fix on its own — a hardcoded heading that
 * has gone stale, a visual that still needs a developer. Not an error and not dismissible:
 * the condition is true until someone changes the site's code.
 */
export function PageHeaderNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex gap-3 rounded-sm border border-warning/30 bg-warning/5 px-4 py-3">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p className="text-xs leading-relaxed text-warning/90">{children}</p>
    </div>
  );
}

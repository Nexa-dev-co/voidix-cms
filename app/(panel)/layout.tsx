import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { requireMember } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();

  return (
    // The sidebar earns its 240px from 1024px up, and no sooner. On a tablet that column is a
    // third of the screen spent on eight links, and the leads table needs the room far more —
    // below `lg` the nav goes back to the horizontal strip it already uses on a phone.
    //
    // From `lg` the shell owns the viewport and the two columns scroll independently, so the nav
    // stays put however far down the leads you go. `overflow-hidden` keeps them the *only* two
    // things that scroll: without it a stray pixel of overflow gives the whole shell a third
    // scrollbar that moves both columns at once.
    <div className="flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border px-5 py-5 lg:w-60 lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <Link href="/" className="flex items-baseline gap-2 px-3">
          <span className="font-display text-lg font-extrabold tracking-tight">voidix</span>
          <span className="eyebrow">control</span>
        </Link>

        {/* Hiding the content links from a salesperson is presentation, not protection — the
            route group's layout and every action check the role for themselves. */}
        <SidebarNav role={member.role} />

        <div className="mt-auto flex flex-col gap-2 border-t border-border px-3 pt-4">
          <p className="truncate text-sm text-fg" title={member.email}>
            {member.name}
          </p>
          <p className="truncate text-[11px] text-muted">
            {member.role === "ADMIN" ? "Admin" : "Sales"}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 text-xs text-muted transition-colors duration-150 hover:text-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* No width cap here. A page that wants one wraps itself in ReadingColumn; a page built to
          be scanned rather than read — the leads table, the reports — uses the whole shell. */}
      {/* py-8 rather than py-12: 96px of vertical padding is a sixth of a laptop screen, and on a
          page whose job is to show rows that padding comes out of the rows. It also lines the
          content up with the sidebar's own py-6. */}
      <main className="min-w-0 flex-1 px-5 py-8 lg:overflow-y-auto lg:px-10">
        {children}
      </main>
    </div>
  );
}

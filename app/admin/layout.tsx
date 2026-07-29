import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { requireMember } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border px-5 py-5 md:w-60 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link href="/admin" className="flex items-baseline gap-2 px-3">
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

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-12">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}

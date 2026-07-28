import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { requireUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border px-5 py-5 md:w-60 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link href="/admin" className="flex items-baseline gap-2 px-3">
          <span className="font-display text-lg font-extrabold tracking-tight">voidix</span>
          <span className="eyebrow">control</span>
        </Link>

        <SidebarNav />

        <div className="mt-auto flex flex-col gap-2 border-t border-border px-3 pt-4">
          <p className="truncate text-[11px] text-muted" title={user.email ?? undefined}>
            {user.email}
          </p>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs text-muted transition-colors duration-150 hover:text-accent"
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

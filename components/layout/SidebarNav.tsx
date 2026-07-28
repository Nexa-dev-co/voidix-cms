"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", number: "00" },
  { href: "/admin/services", label: "Services", number: "01" },
  { href: "/admin/works", label: "Works", number: "02" },
  { href: "/admin/faq", label: "FAQ", number: "03" },
  { href: "/admin/releases", label: "Releases", number: "04" },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {NAV_ITEMS.map((item) => {
        // Overview is the only exact match — every other section owns its subtree, so an
        // edit page keeps its parent lit.
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150 ${
              isActive ? "bg-card text-fg" : "text-muted hover:bg-card/60 hover:text-fg"
            }`}
          >
            <span
              className={`text-[10px] tabular-nums tracking-widest ${
                isActive ? "text-accent" : "text-muted/60"
              }`}
            >
              {item.number}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

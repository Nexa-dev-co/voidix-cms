"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { TeamRole } from "@/generated/prisma/enums";

// Site copy. Admin only — a salesperson has no business republishing the homepage.
const CONTENT_ITEMS = [
  { href: "/admin/services", label: "Services", number: "01" },
  { href: "/admin/works", label: "Works", number: "02" },
  { href: "/admin/faq", label: "FAQ", number: "03" },
  { href: "/admin/contact", label: "Contact", number: "04" },
  { href: "/admin/footer", label: "Footer", number: "05" },
] as const;

// Separated from the content sections: leads are inbound work and releases are a log.
// Neither is copy you edit, so grouping them together would blur what "publish" acts on.
const OPERATIONS_ITEMS = [
  { href: "/admin/leads", label: "Leads", adminOnly: false },
  // Both roles: the page scopes itself through visibility.ts, so a salesperson opening it sees
  // their own pipeline rather than the team's.
  { href: "/admin/reports", label: "Reports", adminOnly: false },
  { href: "/admin/team", label: "Team", adminOnly: true },
  { href: "/admin/settings", label: "Settings", adminOnly: true },
  { href: "/admin/releases", label: "Releases", adminOnly: true },
] as const;

export function SidebarNav({ role }: { role: TeamRole }) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const linkClasses = (active: boolean) =>
    `group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150 ${
      active ? "bg-card text-fg" : "text-muted hover:bg-card/60 hover:text-fg"
    }`;

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      <Link
        href="/admin"
        aria-current={isActive("/admin") ? "page" : undefined}
        className={linkClasses(isActive("/admin"))}
      >
        <span
          className={`text-[10px] tabular-nums tracking-widest ${
            isActive("/admin") ? "text-accent" : "text-muted/60"
          }`}
        >
          00
        </span>
        Overview
      </Link>

      {isAdmin &&
        CONTENT_ITEMS.map((item) => {
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={linkClasses(active)}
            >
              <span
                className={`text-[10px] tabular-nums tracking-widest ${
                  active ? "text-accent" : "text-muted/60"
                }`}
              >
                {item.number}
              </span>
              {item.label}
            </Link>
          );
        })}

      <span aria-hidden className="hidden lg:my-2 lg:block lg:border-t lg:border-border" />

      {OPERATIONS_ITEMS.filter((item) => isAdmin || !item.adminOnly).map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={linkClasses(active)}
          >
            <span aria-hidden className="w-[1.375rem]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

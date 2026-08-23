"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { TeamRole } from "@/generated/prisma/enums";

// Site copy. Admin only — a salesperson has no business republishing the homepage.
const CONTENT_ITEMS = [
  { href: "/services", label: "Services", number: "01" },
  { href: "/works", label: "Works", number: "02" },
  { href: "/faq", label: "FAQ", number: "03" },
  { href: "/contact", label: "Contact", number: "04" },
  { href: "/footer", label: "Footer", number: "05" },
  // The document pages. They sit after the five homepage sections because that is the order a
  // visitor meets them — the homepage first, then the two pages it links out to.
  { href: "/about", label: "About", number: "06" },
  { href: "/careers", label: "Careers", number: "07" },
  // Last because it is not a section of the site — it is the form that appears inside six of
  // them, plus the vocabulary its subject line comes from.
  { href: "/enquiry-form", label: "Enquiry form", number: "08" },
] as const;

// Separated from the content sections: leads are inbound work and releases are a log.
// Neither is copy you edit, so grouping them together would blur what "publish" acts on.
const OPERATIONS_ITEMS = [
  { href: "/leads", label: "Leads", adminOnly: false },
  // What the website sent, before anyone has decided it is worth anything. Admin-only: neither
  // table has an owner column, so `visibility.ts` has nothing to scope by and the role is the
  // whole gate. Directly above Leads' neighbours because triaging it feeds them.
  { href: "/inbox", label: "Inbox", adminOnly: true },
  // Hiring, not sales. A CV is not pipeline material.
  { href: "/applications", label: "Applications", adminOnly: true },
  // Both roles: the page scopes itself through visibility.ts, so a salesperson opening it sees
  // their own pipeline rather than the team's.
  { href: "/reports", label: "Reports", adminOnly: false },
  // What people do on the WEBSITE, as opposed to what the pipeline is doing — anonymous visitors,
  // the loader they may not survive, how far they get. Next to Reports because both are read rather
  // than edited, and separate from it because the two answer different questions for different
  // people. Admin-only for the reason Inbox is: `journey_events` has no owner column, so
  // `visibility.ts` has nothing to scope by and the role is the whole gate.
  { href: "/user-activity", label: "User activity", adminOnly: true },
  { href: "/team", label: "Team", adminOnly: true },
  { href: "/settings", label: "Settings", adminOnly: true },
  { href: "/releases", label: "Releases", adminOnly: true },
] as const;

export function SidebarNav({ role }: { role: TeamRole }) {
  const pathname = usePathname();
  const isAdmin = role === "ADMIN";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const linkClasses = (active: boolean) =>
    `group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150 ${
      active ? "bg-card text-fg" : "text-muted hover:bg-card/60 hover:text-fg"
    }`;

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      <Link
        href="/"
        aria-current={isActive("/") ? "page" : undefined}
        className={linkClasses(isActive("/"))}
      >
        <span
          className={`text-[10px] tabular-nums tracking-widest ${
            isActive("/") ? "text-accent" : "text-muted/60"
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

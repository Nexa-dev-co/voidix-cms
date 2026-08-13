"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buildLeadsHref, type LeadQueryParams } from "@/lib/leads/leadsView";

/**
 * Search across name, email and company.
 *
 * Submits rather than filtering as you type: the query runs in the database, so a keystroke-level
 * search would be a round trip per character. The term lives in the URL like every other filter,
 * which keeps a searched view linkable and survives a refresh.
 */
export function LeadsSearch({ params }: { params: LeadQueryParams }) {
  const router = useRouter();
  const [term, setTerm] = useState(params.search);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(buildLeadsHref(params, { search: term.trim() }));
      }}
      className="flex items-center gap-2"
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, email or company"
          aria-label="Search leads"
          className="w-56 rounded-sm border border-border bg-field py-1.5 pr-3 pl-8 text-xs text-fg placeholder:text-muted transition-colors duration-150 hover:border-border-strong focus:border-accent focus:outline-none"
        />
      </div>

      {params.search.length > 0 && (
        <Link
          href={buildLeadsHref(params, { search: "" })}
          onClick={() => setTerm("")}
          aria-label="Clear search"
          className="text-muted transition-colors duration-150 hover:text-fg"
        >
          <X className="size-3.5" />
        </Link>
      )}
    </form>
  );
}

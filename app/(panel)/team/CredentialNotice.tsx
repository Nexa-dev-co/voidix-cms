"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Shows a newly issued password once.
 *
 * Supabase stores only a hash, so this value cannot be looked up again — it is deliberately
 * loud, and says so. Losing it isn't a disaster (reset issues another), but silently closing
 * the page and wondering later is.
 */
export function CredentialNotice({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const [hasCopied, setHasCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-accent/40 bg-accent/5 p-4">
      <p className="text-xs leading-relaxed text-accent">
        Send these to {email} now — this password is shown once and can&rsquo;t be looked up
        again. If it&rsquo;s lost, issue a new one from their row.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm border border-border bg-field px-3 py-2 font-mono text-sm text-fg">
          {password}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setHasCopied(true);
              window.setTimeout(() => setHasCopied(false), 2000);
            } catch {
              // Clipboard access is denied over plain HTTP and in some browsers. The password
              // is visible and selectable either way, so this fails quietly rather than
              // throwing an error at someone mid-onboarding.
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-3 py-2 text-xs text-fg transition-colors duration-150 hover:border-accent hover:text-accent"
        >
          {hasCopied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {hasCopied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-[11px] text-muted">
        They should change it after signing in.
      </p>
    </div>
  );
}

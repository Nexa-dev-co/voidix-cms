import type { ReactNode } from "react";

/**
 * The comfortable reading width for a page you edit rather than scan.
 *
 * The admin shell used to apply this to everything, which meant the leads table was capped at
 * 768px no matter how wide the window was — the default six columns alone come to ~870px, so it
 * opened already scrolled sideways. Pages now declare their own width: prose and forms wrap in
 * this, data tables fill the shell.
 *
 * One home for the number, so a change to the reading width moves every form together instead of
 * drifting page by page.
 */
export default function ReadingColumn({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl">{children}</div>;
}

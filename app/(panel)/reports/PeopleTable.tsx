import Link from "next/link";

import type { PersonRow } from "@/lib/leads/reports";

/**
 * Per-person activity.
 *
 * A table, not a chart. Four measures across four-or-more people is either a grouped bar chart
 * needing four series colours — past the point where colour tells anyone anything — or a grid of
 * numbers people can actually read and sort by eye. The skill's own rule: past about seven
 * classes carrying meaning, use a table.
 *
 * A win counts for whoever owns the lead now, which is what the leads list's Owner column shows,
 * so the two can never disagree.
 */
export default function PeopleTable({ people }: { people: PersonRow[] }) {
  if (people.length === 0) {
    return <p className="py-6 text-xs text-muted">Nobody on the team yet.</p>;
  }

  const busiest = Math.max(...people.map((person) => person.openPipeline), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] tracking-[0.12em] text-muted uppercase">
            <th scope="col" className="py-2 font-normal">
              Person
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Open now
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              New
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Attempts
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Won
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-b border-border/60 last:border-0">
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <span className={person.isActive ? "text-fg" : "text-muted"}>{person.name}</span>
                  {!person.isActive && (
                    <span className="rounded-sm border border-border-strong px-1 py-0.5 text-[10px] text-muted">
                      inactive
                    </span>
                  )}
                </span>
              </td>

              <td className="py-2 text-right">
                <span className="flex items-center justify-end gap-2">
                  {/* A hairline bar behind the number, not instead of it: the figure is the
                      point, and the bar only makes "who is carrying the most" scannable. */}
                  <span aria-hidden className="hidden h-1 w-16 rounded-full bg-border sm:block">
                    <span
                      className="block h-full rounded-full bg-chart-3"
                      style={{ width: `${(person.openPipeline / busiest) * 100}%` }}
                    />
                  </span>
                  <span className="tabular-nums text-fg">{person.openPipeline}</span>
                </span>
              </td>

              <td className="py-2 text-right tabular-nums text-muted">{person.newLeads}</td>
              <td className="py-2 text-right tabular-nums text-muted">{person.attempts}</td>
              <td className="py-2 text-right tabular-nums">
                {person.won > 0 ? (
                  <span className="text-success">{person.won}</span>
                ) : (
                  <span className="text-muted/50">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-[11px] text-muted/60">
        Wins count for whoever owns the lead now, the same as the{" "}
        <Link href="/leads" className="text-accent hover:underline">
          leads list
        </Link>{" "}
        shows. Attempts count who logged them.
      </p>
    </div>
  );
}

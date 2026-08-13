import Link from "next/link";

import LeadsTrend from "@/app/(panel)/reports/LeadsTrend";
import PeopleTable from "@/app/(panel)/reports/PeopleTable";
import PipelineFunnel from "@/app/(panel)/reports/PipelineFunnel";
import ReportFilters from "@/app/(panel)/reports/ReportFilters";
import SourceBreakdown from "@/app/(panel)/reports/SourceBreakdown";
import StatTile from "@/app/(panel)/reports/StatTile";
import { TeamRole } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";
import { PERIOD_PHRASES, resolveWindow } from "@/lib/leads/reportPeriod";
import { buildLeadReport, type HygieneCounts, type LeadReport } from "@/lib/leads/reports";
import { ownerIdFrom, parseReportParams } from "@/lib/leads/reportsView";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ReportsPage(props: PageProps<"/reports">) {
  const member = await requireMember();
  const searchParams = await props.searchParams;
  const params = parseReportParams(searchParams);
  const isAdmin = member.role === TeamRole.ADMIN;

  // One instant for every figure on the page. Reading the clock inside each query would let a
  // report straddling midnight disagree with itself about what "today" means.
  const now = new Date();
  const window = resolveWindow(params.period, now);

  const [report, people] = await Promise.all([
    buildLeadReport({ member, window, ownerId: ownerIdFrom(params) }),
    isAdmin
      ? prisma.teamMember.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const phrase = PERIOD_PHRASES[params.period];

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Reports"
        description={
          isAdmin
            ? "How the pipeline is moving, where the leads come from, and who is working them."
            : "Your pipeline, your activity, and what needs chasing."
        }
      />

      <ReportFilters params={params} people={people} />

      {report.isEmpty ? (
        <EmptyReport isAdmin={isAdmin} phrase={phrase} />
      ) : (
        <div className="flex flex-col gap-10">
          {/* Ordered by who is reading. A salesperson opens this to find out what needs chasing,
              so hygiene leads; an admin opens it to find out how the team is doing, so the
              headline figures lead and hygiene closes. Same sections, same numbers, different
              first thing your eye lands on. */}
          {isAdmin ? (
            <>
              <Headline report={report} phrase={phrase} />
              <Funnel report={report} />
              <Sources report={report} phrase={phrase} />
              <Trend report={report} phrase={phrase} />
              <Team report={report} phrase={phrase} />
              <Hygiene hygiene={report.hygiene} />
            </>
          ) : (
            <>
              <Hygiene hygiene={report.hygiene} />
              <Headline report={report} phrase={phrase} />
              <Funnel report={report} />
              <Trend report={report} phrase={phrase} />
              <Sources report={report} phrase={phrase} />
            </>
          )}
        </div>
      )}
    </>
  );
}

function Headline({ report, phrase }: { report: LeadReport; phrase: string }) {
  const { headline } = report;

  return (
    <Section title="Headline" note={`Counted over ${phrase}.`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="New leads" value={String(headline.newLeads.current)} delta={headline.newLeads} />
        <StatTile
          label="Won"
          value={String(headline.won.current)}
          delta={headline.won}
          tone={headline.won.current > 0 ? "good" : "neutral"}
        />
        <StatTile
          label="Lost"
          value={String(headline.lost.current)}
          delta={headline.lost}
          invertDelta
          tone={headline.lost.current > 0 ? "bad" : "neutral"}
        />
        <StatTile
          label="Win rate"
          value={headline.winRate.current === null ? "—" : `${headline.winRate.current.toFixed(1)}%`}
          hint={
            headline.winRate.current === null
              ? "Nothing closed either way yet."
              : headline.averageDaysToWin !== null
                ? `${headline.averageDaysToWin} days to win on average`
                : undefined
          }
          delta={
            headline.winRate.current !== null && headline.winRate.previous !== null
              ? {
                  current: Math.round(headline.winRate.current),
                  previous: Math.round(headline.winRate.previous),
                }
              : null
          }
        />
      </div>
    </Section>
  );
}

function Funnel({ report }: { report: LeadReport }) {
  return (
    <Section
      title="Open pipeline"
      note="As it stands right now, not over the period — Won and Lost are in the headline above."
    >
      <Card>
        <PipelineFunnel stages={report.funnel} />
      </Card>
    </Section>
  );
}

function Sources({ report, phrase }: { report: LeadReport; phrase: string }) {
  return (
    <Section title="Where leads came from" note={`Leads that arrived in ${phrase}.`}>
      <Card>
        <SourceBreakdown sources={report.sources} />
      </Card>
    </Section>
  );
}

function Trend({ report, phrase }: { report: LeadReport; phrase: string }) {
  return (
    <Section title="New leads over time" note={`Arrivals across ${phrase}.`}>
      <Card>
        <LeadsTrend points={report.overTime} />
      </Card>
    </Section>
  );
}

function Team({ report, phrase }: { report: LeadReport; phrase: string }) {
  return (
    <Section title="The team" note={`New leads, attempts and wins over ${phrase}.`}>
      <Card>
        <PeopleTable people={report.people} />
      </Card>
    </Section>
  );
}

/**
 * The things that rot.
 *
 * Every tile links into the leads list already filtered, because a number nobody can act on is
 * just a number — "9 overdue" should be one click from the nine.
 */
function Hygiene({ hygiene }: { hygiene: HygieneCounts }) {
  const tiles = [
    {
      label: "Overdue",
      value: hygiene.overdue,
      href: "/leads?due=overdue",
      tone: "bad" as const,
      hint: "Follow-up date has passed.",
    },
    {
      label: "Due today",
      value: hygiene.dueToday,
      href: "/leads?due=today",
      tone: "neutral" as const,
      hint: "Promised for today.",
    },
    {
      label: "Never contacted",
      value: hygiene.neverContacted,
      href: "/leads?stage=open",
      tone: "neutral" as const,
      hint: "Open, with nothing logged against them.",
    },
    {
      label: "Gone quiet",
      value: hygiene.goneQuiet,
      href: "/leads?stage=open",
      tone: "neutral" as const,
      hint: `Open, but untouched for ${hygiene.staleAfterDays} days.`,
    },
  ];

  return (
    <Section title="Needs attention" note="Right now, whatever period is selected above.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="rounded-sm transition-opacity duration-150 hover:opacity-80"
          >
            <StatTile
              label={tile.label}
              value={String(tile.value)}
              hint={tile.hint}
              tone={tile.value > 0 ? tile.tone : "neutral"}
            />
          </Link>
        ))}
      </div>
    </Section>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="eyebrow">{title}</h2>
        <p className="mt-1 text-[11px] text-muted/60">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sm border border-border bg-card p-4">{children}</div>;
}

function EmptyReport({ isAdmin, phrase }: { isAdmin: boolean; phrase: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm text-fg">Nothing to report for {phrase}.</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted">
        {isAdmin
          ? "No leads arrived, nothing closed, and the pipeline is empty. Try a longer period, or add some leads."
          : "No leads of yours arrived or closed in this window. Try a longer period."}
      </p>
      <p className="mt-4">
        <Link href="/leads" className="text-xs text-accent hover:underline">
          Go to the leads list
        </Link>
      </p>
    </div>
  );
}

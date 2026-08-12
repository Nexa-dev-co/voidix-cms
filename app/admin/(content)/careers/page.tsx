import Link from "next/link";

import { moveRoleAction } from "@/app/admin/(content)/careers/actions";
import {
  CareersForm,
  type CareersFormValues,
} from "@/app/admin/(content)/careers/CareersForm";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { ReorderControls } from "@/components/ui/ReorderControls";
import { formatOrdinal } from "@/lib/content/contentPayload";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The copy the site ships today, from components/pages/Careers/careersContent.ts. Shown until
// the page is saved for the first time; nothing is stored until then.
const CAREERS_DEFAULTS: CareersFormValues = {
  eyebrow: "Careers",
  titleLine1: "We hire the person",
  titleLine2: "who reads the shader.",
  lead: "Four to six of us, depending on the season — engineers and designers in one room, a chain of command you can cross in a sentence, work that ships with your name still on the commit. If that sounds like your size, we would like to read what you have built.",
  workingHere: [
    {
      claim: "You own the surface.",
      backing:
        "Not a ticket queue. A thing with edges, a date, and your judgement in the middle of it — including the judgement to say the plan was wrong.",
    },
    {
      claim: "The bar is the frame budget.",
      backing:
        "Nothing ships that cannot hold sixty frames on the laptop in the client's bag. It is the most useful argument-ender we have, and it does not care whose idea it was.",
    },
    {
      claim: "You will be read.",
      backing:
        "Every line goes past someone who will ask why. It is the job's best part and its first week's worst, in that order.",
    },
  ],
  hiringPhases: [
    {
      span: "Day 0",
      name: "You write",
      detail: "A note, and a link or a CV. No cover letter, no form with nine required fields.",
    },
    {
      span: "Inside two days",
      name: "We read the work",
      detail: "The work first, the CV second. You get an answer either way, from a person.",
    },
    {
      span: "Week 1",
      name: "Two conversations",
      detail: "One about the craft, one about everything else. No whiteboard algorithms.",
    },
    {
      span: "Week 2",
      name: "The offer, whole",
      detail: "Real numbers, a start date, and the name of the first surface you would own.",
    },
  ],
  rolesEmptyLine:
    "No roles are open right now — we hire when a surface needs an owner, not on a calendar.",
  rolesEmptyInvite: "Write to us anyway",
  openApplicationTitle: "Then write anyway.",
  openApplicationLead:
    "The list above is what we know we need, and it has been wrong before. Tell us what you do and what you would want to own.",
  openApplicationSubject: "Open application",
  // No trailing space, unlike the site's constant — the payload adds the gap back on publish.
  openApplicationSeed: "What I do, and what I would want to own:",
  commitmentLabel: "What you are looking for",
  commitmentOptions: ["Full-time", "Part-time", "Internship"],
  applicationBriefLabel: "Why you",
  applicationSubmitLabel: "Send it",
  aboutInvite: "Read what the studio is first",
};

export default async function CareersPage() {
  const [careers, workingHere, hiringPhases, commitmentOptions, roles] = await Promise.all([
    prisma.careersPage.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.careersClaim.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careersHiringPhase.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careersCommitmentOption.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.careerRole.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Section 07"
        title="Careers"
        description="The open roles, and every string the /careers document renders around them."
        action={
          <ButtonLink href="/admin/careers/roles/new" variant="secondary">
            Add role
          </ButtonLink>
        }
      />

      <PageHeaderNote>
        The application form on the site collects everything it should and then blocks its own
        submit — there is no endpoint behind it yet, so <strong className="text-fg">a role
        published here cannot actually be applied to</strong>. Dropping a job application silently
        is worse than dropping an enquiry, because the person is left believing they applied.
        Wiring that up is a developer task.
      </PageHeaderNote>

      <section className="mb-10">
        <h2 className="eyebrow mb-4">Open roles</h2>

        <div className="flex flex-col divide-y divide-border border-y border-border">
          {roles.map((role, position) => (
            <div key={role.id} className="flex items-start gap-3 py-5">
              <span className="shrink-0 pt-1 text-xs tabular-nums text-muted/60">
                {formatOrdinal(position)}
              </span>

              <Link
                href={`/admin/careers/roles/${role.id}`}
                className="group min-w-0 flex-1"
              >
                <p className="text-sm text-fg transition-colors group-hover:text-accent">
                  {role.title}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {role.location} · {role.commitment}
                </p>
              </Link>

              <ReorderControls
                id={role.id}
                isFirst={position === 0}
                isLast={position === roles.length - 1}
                moveAction={moveRoleAction}
                label={role.title}
              />
            </div>
          ))}
        </div>

        {roles.length === 0 && (
          <p className="border-y border-border py-8 text-sm text-muted">
            No roles. The page stands in this state on its own — it renders the empty-roles line
            below instead, which is why that field is required.
          </p>
        )}
      </section>

      <div className="border-t border-border pt-8">
        <h2 className="eyebrow mb-6">Page copy</h2>

        <CareersForm
          careers={
            careers
              ? {
                  eyebrow: careers.eyebrow,
                  titleLine1: careers.titleLine1,
                  titleLine2: careers.titleLine2,
                  lead: careers.lead,
                  workingHere: workingHere.map((claim) => ({
                    claim: claim.claim,
                    backing: claim.backing,
                  })),
                  hiringPhases: hiringPhases.map((phase) => ({
                    span: phase.span,
                    name: phase.name,
                    detail: phase.detail,
                  })),
                  rolesEmptyLine: careers.rolesEmptyLine,
                  rolesEmptyInvite: careers.rolesEmptyInvite,
                  openApplicationTitle: careers.openApplicationTitle,
                  openApplicationLead: careers.openApplicationLead,
                  openApplicationSubject: careers.openApplicationSubject,
                  openApplicationSeed: careers.openApplicationSeed,
                  commitmentLabel: careers.commitmentLabel,
                  commitmentOptions: commitmentOptions.map((option) => option.label),
                  applicationBriefLabel: careers.applicationBriefLabel,
                  applicationSubmitLabel: careers.applicationSubmitLabel,
                  aboutInvite: careers.aboutInvite,
                }
              : CAREERS_DEFAULTS
          }
        />
      </div>
    </>
  );
}

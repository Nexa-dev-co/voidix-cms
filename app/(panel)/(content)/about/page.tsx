import { AboutForm, type AboutFormValues } from "@/app/(panel)/(content)/about/AboutForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";
import { joinParagraphs } from "@/lib/text/plainText";

export const dynamic = "force-dynamic";

// The copy the site ships today, lifted from components/pages/About/aboutContent.ts. Shown
// before anything has been saved here, so the form is never rendered with empty required
// fields — and so the first edit is a change to real copy rather than a blank page to fill.
const ABOUT_DEFAULTS: AboutFormValues = {
  eyebrow: "About",
  titleLine1: "Most software is weightless.",
  titleLine2: "We build the other kind.",
  lead: "Voidix is a small engineering studio. We take the surface that has to be fast, legible and alive at the same time — the trading floor, the clinical record, the storefront that behaves like film — and we build it properly, with the people who will maintain it in the room.",
  premiseParagraphs: joinParagraphs([
    "Weightless is the default, and mostly that is fine. Software loads, it works, it is forgotten between openings. Nobody was ever meant to feel anything about the expenses tool.",
    "Gravity is the opposite property, and it is not decoration. A product has it when leaving costs something: when the number lands where the eye already was, when the motion is carrying information rather than apologising for a wait, when the thing is quick enough that nobody has to think about the thing. That is an engineering result before it is a design one, which is why the two are not separate jobs here.",
  ]),
  premiseQuote:
    "A product earns its gravity in the first four hundred milliseconds, and keeps it over the next four hundred days.",
  principles: [
    {
      claim: "The hard part first.",
      backing:
        "The first fortnight goes on whatever the project is most likely to die of — the render path, the data volume, the thing nobody has built before. An estimate given before that is a guess in a suit.",
    },
    {
      claim: "One team, all the way down.",
      backing:
        "The people who design the interaction write the shader that draws it. Nothing is thrown over a wall, because there is no wall to throw it over.",
    },
    {
      claim: "Performance is a design decision.",
      backing:
        "Sixty frames on hardware people actually own is a constraint we design inside, not a pass we run at the end. It has killed features here, and it should have.",
    },
    {
      claim: "Handover is a deliverable.",
      backing:
        "Documented, commented, and walked through until someone on your side can defend every decision in it. If you never need to call us again, that is the better outcome and we will take it.",
    },
  ],
  buildPhases: [
    {
      span: "Week 1–2",
      name: "Prove",
      detail:
        "We build the riskiest part first and find out whether it survives contact with real data.",
    },
    {
      span: "Week 2–3",
      name: "Shape",
      detail:
        "You get a shape: what we would build, what we would refuse to build, and what it takes.",
    },
    {
      span: "6–24 weeks",
      name: "Build",
      detail: "Something working every week, on the real stack. Not a demo that becomes a rewrite.",
    },
    {
      span: "Then the door stays open",
      name: "Hand over",
      detail:
        "Keys, docs and a stabilisation window while live traffic finds what staging never did.",
    },
  ],
  instruments: [
    { label: "First reply", value: "Under 5 days" },
    { label: "First proof", value: "2 weeks" },
    { label: "Frame budget", value: "16.7 ms" },
    { label: "Handover", value: "Fully documented" },
  ],
  instrumentsNote:
    "These are commitments, not a scoreboard. They are the four numbers we will be held to before a line of code exists.",
  stack: [
    "TypeScript",
    "React & Next.js",
    "WebGL / GLSL",
    "Three.js",
    "Realtime streams",
    "iOS & Android",
    "Design systems",
    "Performance budgets",
  ],
  stackNote:
    "The list is short on purpose. We would rather be the studio that knows eight things completely than the one that lists forty.",
  closingTitle: "Tell us what you are building.",
  closingLead:
    "A paragraph is enough — what it is, who it is for, and what has to be true on the day it ships.",
  careersInvite: "Or come and build it with us",
};

export default async function AboutPage() {
  const [about, premiseParagraphs, principles, buildPhases, instruments, stackItems] =
    await Promise.all([
      prisma.aboutPage.findUnique({ where: { id: SINGLETON_ROW_ID } }),
      prisma.aboutPremiseParagraph.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.aboutPrinciple.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.aboutBuildPhase.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.aboutInstrument.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.aboutStackItem.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Section 06"
        title="About"
        description="Every string the /about document renders, in the order the page renders them."
      />

      {!about && (
        <PageHeaderNote>
          Nothing has been saved here yet, so these fields hold the copy the site ships today —
          nothing is stored until you press Save. The page&rsquo;s five numbered sections and their
          anchors stay in the site&rsquo;s source: each section&rsquo;s key is both its{" "}
          <code className="text-fg">#anchor</code> and the station the orbit rail scrolls to, so
          renaming one is a developer change.
        </PageHeaderNote>
      )}

      <AboutForm
        about={
          about
            ? {
                eyebrow: about.eyebrow,
                titleLine1: about.titleLine1,
                titleLine2: about.titleLine2,
                lead: about.lead,
                premiseParagraphs: joinParagraphs(
                  premiseParagraphs.map((paragraph) => paragraph.body),
                ),
                premiseQuote: about.premiseQuote,
                principles: principles.map((principle) => ({
                  claim: principle.claim,
                  backing: principle.backing,
                })),
                buildPhases: buildPhases.map((phase) => ({
                  span: phase.span,
                  name: phase.name,
                  detail: phase.detail,
                })),
                instruments: instruments.map((instrument) => ({
                  label: instrument.label,
                  value: instrument.value,
                })),
                instrumentsNote: about.instrumentsNote,
                stack: stackItems.map((item) => item.label),
                stackNote: about.stackNote,
                closingTitle: about.closingTitle,
                closingLead: about.closingLead,
                careersInvite: about.careersInvite,
              }
            : ABOUT_DEFAULTS
        }
      />
    </>
  );
}

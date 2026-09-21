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
  titleLine1: "One technology partner.",
  titleLine2: "Multiple connected systems.",
  lead: "Voidix is a custom software development company building digital products and business systems for companies across the United States. We turn new ideas, outdated tools, manual processes, and disconnected systems into working software.",
  premiseParagraphs: joinParagraphs([
    "Off-the-shelf software asks your business to adapt to the product. Custom software works the other way around: it is designed around your processes, customers, data, and goals.",
    "Your website should communicate with your CRM. Your CRM should communicate with your applications. Your applications should communicate with your internal systems. Automation should connect the work between them. We build that technology layer as one system.",
  ]),
  premiseQuote: "Your business → Your workflow → Your software.",
  principles: [
    {
      claim: "Replace manual processes.",
      backing:
        "Move repetitive work out of spreadsheets, emails, and disconnected tools and into systems that can carry it reliably.",
    },
    {
      claim: "Replace outdated software.",
      backing:
        "Modernize legacy systems and replace software that no longer fits the way your business operates.",
    },
    {
      claim: "Launch a new product.",
      backing:
        "Turn an idea into an MVP, SaaS platform, web application, mobile product, or connected customer experience.",
    },
    {
      claim: "Connect your systems.",
      backing:
        "Integrate your CRM, website, applications, APIs, databases, payment systems, and business tools.",
    },
    {
      claim: "Add AI where it helps.",
      backing:
        "Identify practical uses for AI in customer service, operations, sales, internal knowledge, documents, and data-heavy workflows.",
    },
    {
      claim: "Build a competitive product.",
      backing:
        "Create technology around your customers and operating model instead of relying on generic software to define both.",
    },
  ],
  buildPhases: [
    {
      span: "01",
      name: "Discover",
      detail:
        "We learn your business, users, current technology, workflows, and objectives before deciding what to build.",
    },
    {
      span: "02",
      name: "Architect",
      detail:
        "We turn the requirements into a roadmap covering product structure, data, integrations, automation, and priorities.",
    },
    {
      span: "03",
      name: "Design",
      detail:
        "We design the interfaces and workflows around the people who will use the product and the decisions they need to make.",
    },
    {
      span: "04",
      name: "Build",
      detail:
        "We turn the approved architecture and designs into working software, with progress visible throughout development.",
    },
    {
      span: "05",
      name: "Launch",
      detail:
        "We test, deploy, integrate, and prepare the product for real users and real business operations.",
    },
    {
      span: "06",
      name: "Evolve",
      detail:
        "We can continue improving the product, adding features, connecting systems, and introducing automation or AI as the business grows.",
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
    "Websites",
    "Web applications",
    "CRM platforms",
    "Mobile apps",
    "SaaS products",
    "AI software",
    "Business automation",
    "Software integrations",
  ],
  stackNote:
    "A project can begin with one system and grow into a connected digital ecosystem without rebuilding the foundation each time.",
  closingTitle: "Tell us what you're building.",
  closingLead:
    "You don't need a perfect technical specification. Tell us what it should do, who will use it, and what needs to be true when it launches.",
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

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

// The live copy, lifted verbatim from the site's three data files:
//   components/sections/ServicesDeck/deckServices.ts  → DECK_SERVICES
//   components/sections/WorksField/worksProjects.ts   → WORKS_PROJECTS
//   components/sections/Chamber/faqEntries.ts         → FAQ_ENTRIES
//
// Everything those files hold that isn't text — model paths, hull profiles, per-ship lights,
// model rotations, rock geometry — stays in the site's source and is intentionally absent.
//
// Seeding is idempotent: it upserts on `slug` (services, projects) and on question text
// (FAQ), so re-running it will not duplicate rows or clobber an edit made in the panel to a
// field the seed does not set.

const SERVICES = [
  {
    slug: "web-experiences",
    name: "Web Experiences",
    eyebrow: "Interfaces with escape velocity",
    description:
      "Bespoke platforms engineered from the metal up — no templates, no compromise. Every interaction is hand-tuned until the product moves like it has its own momentum.",
    capabilities: ["Next.js", "WebGL / GLSL", "Realtime", "Design Systems"],
  },
  {
    slug: "mobile-systems",
    name: "Mobile Systems",
    eyebrow: "Native, in every dimension",
    description:
      "Apps that feel like an extension of the device, not a website in a frame. Sixty frames a second, offline-first, and tactile in the hand.",
    capabilities: ["iOS / Android", "Offline-first", "Motion", "Haptics"],
  },
  {
    slug: "enterprise-platforms",
    name: "Enterprise Platforms",
    eyebrow: "Gravity for your pipeline",
    description:
      "Operational cores that pull every signal into one orbit. We model the way your business actually works, then make the software disappear into the workflow.",
    capabilities: ["Workflow Engines", "Integrations", "Roles & Access", "Reporting"],
  },
  {
    slug: "artificial-intelligence",
    name: "Artificial Intelligence",
    eyebrow: "Intelligence in orbit",
    description:
      "Models wired into real products, not demos. Retrieval, agents, and inference pipelines designed around your data — useful on day one, smarter every week.",
    capabilities: ["LLM Pipelines", "RAG", "Agents", "Evaluation"],
  },
];

const PROJECTS = [
  {
    slug: "aphelion",
    title: "Aphelion",
    client: "Private markets desk",
    year: "2026",
    description:
      "A trading surface that stays calm at speed. Millions of ticks a second resolve into one legible field of motion, so a desk can feel the market shift before it reads the number.",
    tags: ["Realtime", "WebGL", "Streaming Data", "Design System"],
  },
  {
    slug: "meridian",
    title: "Meridian",
    client: "Care network",
    year: "2025",
    description:
      "One record that follows the patient, not the department. We collapsed nine disconnected tools into a single orbit clinicians actually want to open — offline-first, in the palm.",
    tags: ["iOS / Android", "Offline-first", "FHIR", "Motion"],
  },
  {
    slug: "cinder",
    title: "Cinder",
    client: "Fashion house",
    year: "2025",
    description:
      "A store that behaves like a film. Product arrives through cinematic scene changes instead of pages, and conversion climbed because browsing finally felt worth lingering in.",
    tags: ["Commerce", "GSAP", "Headless", "3D Product"],
  },
  {
    slug: "halcyon",
    title: "Halcyon",
    client: "Analytics platform",
    year: "2026",
    description:
      "Intelligence wired into the product, not bolted on as a demo. Retrieval and agents run against live data, so the answer is useful on day one and sharper every week after.",
    tags: ["LLM Pipelines", "RAG", "Agents", "Evaluation"],
  },
];

const FAQ_ENTRIES = [
  {
    question: "What do you actually build?",
    answer: [
      "Software with weight to it. Trading surfaces, clinical records, storefronts that behave like film, retrieval systems that answer from live data — the kind of product a company runs on rather than demos once.",
      "The site you are standing in is the honest answer. Every scene here is the same stack we ship to clients: WebGL, custom shaders, scroll choreography that survives a fast flick on a cheap laptop.",
    ],
  },
  {
    question: "How long does a build take?",
    answer: [
      "A focused product surface takes six to ten weeks. A platform — many surfaces, real data, real users — runs three to six months.",
      "We do not pad that. The first fortnight is spent proving the hardest part works, so the estimate you get in week three is one we can actually hold.",
    ],
  },
  {
    question: "What does it cost?",
    answer: [
      "Engagements start around the price of one senior hire for the same period, and scale with the surface area of the thing being built.",
      "You get a fixed scope and a fixed number, or a rate and an honest burn-down. What you never get is a change-request desk that bills you for the ambiguity in your own brief.",
    ],
  },
  {
    question: "Do you work alongside an in-house team?",
    answer: [
      "Often. We come in on the parts nobody in-house has time to invent — the render pipeline, the interaction model, the performance budget — and leave behind code your team can actually read.",
      "Handover is a deliverable, not a favour. Documented, commented, and walked through until someone on your side can defend every decision in it.",
    ],
  },
  {
    question: "What happens after launch?",
    answer: [
      "We stay for a stabilisation window — real traffic finds things no staging environment will — and then hand you the keys.",
      "If you want us on retainer after that, the door is open. If you never call again because it simply works, that is the better outcome and we will take it.",
    ],
  },
  {
    question: "Will it run on a phone?",
    answer: [
      "Yes, and not as a stripped-down apology. Scenes reframe rather than stretch, the renderer measures its own frame times and trades resolution for smoothness before you ever feel a stutter, and heavy assets ship at the tier the device has earned.",
      "The rule is simple: if it cannot hold sixty frames on hardware people actually own, it is not finished.",
    ],
  },
  {
    question: "How do we start?",
    answer: [
      "Tell us what the thing is for and what breaks today. Not a spec — a problem.",
      "We come back inside a week with a shape for it: what we would build, what we would refuse to build, and what it takes. If the shape is wrong, you have lost a week and nothing else.",
    ],
  },
];

// Migrations run over the direct connection, and so should the seed — it opens one short
// session and does a lot of small writes, which is exactly what PgBouncer is worst at.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL (or DATABASE_URL) must be set to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  for (const [position, service] of SERVICES.entries()) {
    const { capabilities, ...fields } = service;

    const record = await prisma.service.upsert({
      where: { slug: service.slug },
      create: { ...fields, sortOrder: position },
      update: { ...fields, sortOrder: position },
    });

    // Child rows are ordered and small, so replacing the set outright is simpler and safer
    // than diffing it — there is no id worth preserving on a chip.
    await prisma.serviceCapability.deleteMany({ where: { serviceId: record.id } });
    await prisma.serviceCapability.createMany({
      data: capabilities.map((label, index) => ({
        serviceId: record.id,
        sortOrder: index,
        label,
      })),
    });
  }

  for (const [position, project] of PROJECTS.entries()) {
    const { tags, ...fields } = project;

    const record = await prisma.project.upsert({
      where: { slug: project.slug },
      create: { ...fields, sortOrder: position },
      update: { ...fields, sortOrder: position },
    });

    await prisma.projectTag.deleteMany({ where: { projectId: record.id } });
    await prisma.projectTag.createMany({
      data: tags.map((label, index) => ({ projectId: record.id, sortOrder: index, label })),
    });
  }

  for (const [position, entry] of FAQ_ENTRIES.entries()) {
    const existing = await prisma.faqEntry.findFirst({ where: { question: entry.question } });

    const record = existing
      ? await prisma.faqEntry.update({
          where: { id: existing.id },
          data: { sortOrder: position },
        })
      : await prisma.faqEntry.create({
          data: { question: entry.question, sortOrder: position },
        });

    await prisma.faqParagraph.deleteMany({ where: { faqEntryId: record.id } });
    await prisma.faqParagraph.createMany({
      data: entry.answer.map((body, index) => ({
        faqEntryId: record.id,
        sortOrder: index,
        body,
      })),
    });
  }

  const [serviceCount, projectCount, faqCount] = await Promise.all([
    prisma.service.count(),
    prisma.project.count(),
    prisma.faqEntry.count(),
  ]);

  console.log(
    `Seeded: ${serviceCount} services, ${projectCount} projects, ${faqCount} FAQ entries.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

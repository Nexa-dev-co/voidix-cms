import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";
import { seedBlogArticles } from "./blogArticleSeed";

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
//
// The thirty approved blog articles live in `prisma/data/blogArticles.json`, extracted from the
// supplied Word source files by `scripts/extractBlogArticles.py`. Their headings and lists remain
// typed content blocks; the public site never renders arbitrary document markup.
//
// Contact, Footer, About and Careers are deliberately absent. Their starting copy lives in the
// page component that renders the form, so an editor sees it in the fields and nothing is
// written until they press Save — a section that has never been saved is a state the payload
// reports as `null`, and pre-seeding it would throw that signal away.
//
// ⚠ CAREER ROLES ARE ABSENT FOR A STRONGER REASON. The four openings in the site's
// careersContent.ts are invented placeholders describing no vacancy that exists, and unlike a
// placeholder project they are a thing a person can waste an afternoon on. An empty roles list
// is the honest default — the careers page is built to stand in exactly that state and renders
// its own empty line. Real roles get typed in when they are real.

const SERVICES = [
  {
    slug: "web-experiences",
    discipline: "web",
    name: "Websites & Web Apps",
    eyebrow: "Digital products built for performance and conversion",
    description:
      "We design and build high-performance business websites, landing pages, web applications, customer portals, and SaaS products around your brand, users, workflows, and goals.",
    capabilities: ["Business Websites", "Web Applications", "SaaS Products", "Customer Portals"],
  },
  {
    slug: "mobile-systems",
    discipline: "mobile",
    name: "Mobile Apps",
    eyebrow: "iOS and Android experiences connected to your business",
    description:
      "We design and develop mobile applications for customers, employees, and digital products, connecting each app to the APIs, databases, and business systems behind it.",
    capabilities: ["iOS & Android", "Customer Apps", "Business Apps", "Connected Systems"],
  },
  {
    slug: "artificial-intelligence",
    discipline: "ai",
    name: "AI & Automation",
    eyebrow: "Intelligent systems that remove repetitive work",
    description:
      "We build AI-powered applications, assistants, document and knowledge tools, and workflow automation that helps teams work faster and make better use of their data.",
    capabilities: ["AI Assistants", "Workflow Automation", "Document Processing", "Knowledge Systems"],
  },
  {
    slug: "enterprise-platforms",
    discipline: "enterprise",
    name: "Custom Software",
    eyebrow: "Software shaped around the way your business works",
    description:
      "We build custom CRM platforms, internal tools, integrations, dashboards, desktop software, and other tailored systems that connect data and support the way your business operates.",
    capabilities: ["Custom CRM", "Internal Tools", "Software Integrations", "Tailored Systems"],
  },
];

const PROJECTS = [
  {
    slug: "aphelion",
    discipline: "enterprise",
    title: "Aphelion",
    client: "Private markets desk",
    year: "2026",
    description:
      "A trading surface that stays calm at speed. Millions of ticks a second resolve into one legible field of motion, so a desk can feel the market shift before it reads the number.",
    tags: ["Realtime", "WebGL", "Streaming Data", "Design System"],
  },
  {
    slug: "meridian",
    discipline: "mobile",
    title: "Meridian",
    client: "Care network",
    year: "2025",
    description:
      "One record that follows the patient, not the department. We collapsed nine disconnected tools into a single orbit clinicians actually want to open — offline-first, in the palm.",
    tags: ["iOS / Android", "Offline-first", "FHIR", "Motion"],
  },
  {
    slug: "cinder",
    discipline: "web",
    title: "Cinder",
    client: "Fashion house",
    year: "2025",
    description:
      "A store that behaves like a film. Product arrives through cinematic scene changes instead of pages, and conversion climbed because browsing finally felt worth lingering in.",
    tags: ["Commerce", "GSAP", "Headless", "3D Product"],
  },
  {
    slug: "halcyon",
    discipline: "ai",
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
    question: "What does Voidix build?",
    answer: [
      "Voidix builds custom digital products and business software, including websites, web applications, CRM systems, mobile applications, SaaS platforms, AI-powered tools, automation systems, and software integrations.",
    ],
  },
  {
    question: "Does Voidix work with businesses in the United States?",
    answer: [
      "Yes. Voidix works with B2B companies across the United States that need custom software, digital products, automation, integrations, or AI solutions.",
    ],
  },
  {
    question: "Can you build a custom CRM for our business?",
    answer: [
      "Yes. A custom CRM can be designed around your sales pipeline, customer data, team workflows, reporting requirements, integrations, and automation needs.",
    ],
  },
  {
    question: "Can you turn our idea into a SaaS product?",
    answer: [
      "Yes. Voidix can take a software concept through planning, UX and UI design, development, integrations, deployment, and continued product development.",
    ],
  },
  {
    question: "Can you integrate AI into software we already use?",
    answer: [
      "Yes. AI capabilities can be integrated into existing websites, CRMs, SaaS products, internal systems, and business workflows when the technology and use case support it.",
    ],
  },
  {
    question: "Can you automate our existing business processes?",
    answer: [
      "Yes. We can analyze repetitive workflows, connect systems, automate data movement, trigger actions, and reduce unnecessary manual work.",
    ],
  },
  {
    question: "Do you build mobile apps?",
    answer: [
      "Yes. Voidix develops mobile applications for businesses and digital products, including customer-facing apps and internal business applications.",
    ],
  },
  {
    question: "Can you connect our CRM, website, and other software?",
    answer: [
      "Yes. Software integrations can connect websites, CRMs, payment systems, databases, APIs, communication tools, and other business platforms.",
    ],
  },
  {
    question: "How much does custom software development cost?",
    answer: [
      "The cost depends on the product's scope, complexity, integrations, number of users, design requirements, and development requirements. Voidix evaluates the project before providing a development proposal.",
    ],
  },
  {
    question: "How do we start a project?",
    answer: [
      "Tell us what you are building, who it is for, what problem it solves, and what the software needs to accomplish. We will review the requirements and determine the appropriate next step.",
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
  // The four disciplines are created by migration, not here — they are the vocabulary the
  // site keys off, so they exist before any content does. This maps their key to their id.
  const disciplineIdByKey = new Map(
    (await prisma.discipline.findMany({ select: { id: true, key: true } })).map((discipline) => [
      discipline.key,
      discipline.id,
    ]),
  );

  function disciplineId(key: string): string {
    const id = disciplineIdByKey.get(key);

    if (!id) {
      throw new Error(`No discipline "${key}" — run migrations before seeding.`);
    }

    return id;
  }

  for (const [position, service] of SERVICES.entries()) {
    const { capabilities, discipline, ...fields } = service;
    const data = { ...fields, sortOrder: position, disciplineId: disciplineId(discipline) };

    const record = await prisma.service.upsert({
      where: { slug: service.slug },
      create: data,
      update: data,
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
    const { tags, discipline, ...fields } = project;
    const data = { ...fields, sortOrder: position, disciplineId: disciplineId(discipline) };

    const record = await prisma.project.upsert({
      where: { slug: project.slug },
      create: data,
      update: data,
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

  await seedBlogArticles(prisma);

  const [serviceCount, projectCount, faqCount, blogCount] = await Promise.all([
    prisma.service.count(),
    prisma.project.count(),
    prisma.faqEntry.count(),
    prisma.blogPost.count(),
  ]);

  console.log(
    `Seeded: ${serviceCount} services, ${projectCount} projects, ${faqCount} FAQ entries, ${blogCount} blog articles.`,
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

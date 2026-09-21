import { FooterForm, type FooterFormValues } from "@/app/(panel)/(content)/footer/FooterForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// What the site ships today: CONTACT_FOOTER_GROUPS from the contact section's content file, and
// the two strings PageFooter.tsx still holds in its own source.
//
// ⚠ The address is unverified and the four social handles are unclaimed accounts. They are here
// because they give the footer its true shape; the page warns about them rather than quietly
// presenting them as ready. The four document routes below are real.
const FOOTER_DEFAULTS: FooterFormValues = {
  tagline: "Custom Software Development for Modern Businesses",
  signOff: "Voidix — software with its own gravity.",
  linkGroups: [
    {
      title: "Studio",
      links: [
        { label: "About", href: "/about" },
        { label: "Careers", href: "/careers" },
      ],
    },
    {
      title: "Direct",
      links: [{ label: "hello@voidix.studio", href: "mailto:hello@voidix.studio" }],
    },
    {
      title: "Elsewhere",
      links: [
        { label: "X", href: "https://x.com/voidixstudio" },
        { label: "LinkedIn", href: "https://linkedin.com/company/voidixstudio" },
        { label: "GitHub", href: "https://github.com/voidixstudio" },
        { label: "Dribbble", href: "https://dribbble.com/voidixstudio" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ],
};

export default async function FooterPage() {
  const [footer, linkGroups] = await Promise.all([
    prisma.footerContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.footerLinkGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: { links: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Section 05"
        title="Footer"
        description="The link columns shared by the homepage and the document pages, and the two sign-off lines."
      />

      <PageHeaderNote>
        <strong className="text-fg">The direct and social destinations still need verification.</strong>{" "}
        The About, Careers, Privacy, and Terms routes are real. The email address and four social
        handles are still placeholders and should be replaced before launch: a dead social link on
        a studio site reads worse than no social link, and a mailto that bounces is worse than a form.
      </PageHeaderNote>

      <FooterForm
        footer={
          footer
            ? {
                tagline: footer.tagline,
                signOff: footer.signOff,
                linkGroups: linkGroups.map((group) => ({
                  title: group.title,
                  links: group.links.map((link) => ({ label: link.label, href: link.href })),
                })),
              }
            : FOOTER_DEFAULTS
        }
      />
    </>
  );
}

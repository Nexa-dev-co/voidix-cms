import { FooterForm, type FooterFormValues } from "@/app/(panel)/(content)/footer/FooterForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// What the site ships today: CONTACT_FOOTER_GROUPS from the contact section's content file, and
// the two strings PageFooter.tsx still holds in its own source.
//
// The public email, social profiles, and document routes below are verified.
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
      links: [
        { label: "info@voidix.tech", href: "mailto:info@voidix.tech" },
        { label: "Call +1 (307) 317-9422", href: "tel:+13073179422" },
        { label: "Text", href: "sms:+13073179422" },
      ],
    },
    {
      title: "Elsewhere",
      links: [
        { label: "X", href: "https://x.com/Voidix_tech" },
        { label: "LinkedIn", href: "https://www.linkedin.com/company/voidix-tech" },
        { label: "GitHub", href: "https://github.com/Voidix-tech" },
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
        <strong className="text-fg">The direct and social destinations are verified.</strong>{" "}
        The public email, call and text number, X, LinkedIn, GitHub, and the About, Careers, Privacy,
        and Terms routes are ready to publish.
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

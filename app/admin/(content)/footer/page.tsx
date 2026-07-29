import { FooterForm, type FooterFormValues } from "@/app/admin/(content)/footer/FooterForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const FOOTER_DEFAULTS: FooterFormValues = {
  tagline: "software with its own gravity",
  copyright: "© 2026 voidix",
  socialLinks: [],
  legalLinks: [],
};

export default async function FooterPage() {
  const [footer, socialLinks, legalLinks] = await Promise.all([
    prisma.footerContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.footerSocialLink.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.footerLegalLink.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Section 05"
        title="Footer"
        description="The sign-off under the finale — tagline, copyright, and the two link lists."
      />

      {!footer && (
        <PageHeaderNote>
          The site has no footer yet. These fields are pre-filled with a suggestion and are not
          saved until you press Save. Building the footer itself is a developer task.
        </PageHeaderNote>
      )}

      <FooterForm
        footer={
          footer
            ? {
                tagline: footer.tagline,
                copyright: footer.copyright,
                socialLinks: socialLinks.map((link) => ({ label: link.label, url: link.url })),
                legalLinks: legalLinks.map((link) => ({ label: link.label, url: link.url })),
              }
            : FOOTER_DEFAULTS
        }
      />
    </>
  );
}

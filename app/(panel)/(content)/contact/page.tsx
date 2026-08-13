import { ContactForm, type ContactFormValues } from "@/app/(panel)/(content)/contact/ContactForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The copy the section ships today, from components/sections/Contact/contactContent.ts and the
// two EnquiryForm props it is rendered with. Shown until the section is saved here for the
// first time, so the form is never rendered with empty required fields.
const CONTACT_DEFAULTS: ContactFormValues = {
  title: "Tell us what you are building.",
  lead: "A paragraph is enough — what it is, who it is for, and what has to be true on the day it ships. You will get an answer from the people who would build it, not a sales desk.",
  briefLabel: "What you are building",
  submitLabel: "Send it",
};

export default async function ContactPage() {
  const contact = await prisma.contactSection.findUnique({ where: { id: SINGLETON_ROW_ID } });

  return (
    <>
      <PageHeader
        eyebrow="Section 04"
        title="Contact"
        description="The section's title and lead, and the two strings its form actually reads."
      />

      {!contact && (
        <PageHeaderNote>
          Nothing has been saved here yet, so these fields hold the copy the section ships today —
          nothing is stored until you press Save. The site does not read this database yet, so an
          edit here changes the draft, not the live page.
        </PageHeaderNote>
      )}

      <ContactForm contact={contact ?? CONTACT_DEFAULTS} />
    </>
  );
}

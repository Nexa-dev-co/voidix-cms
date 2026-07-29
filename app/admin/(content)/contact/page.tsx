import { ContactForm, type ContactFormValues } from "@/app/admin/(content)/contact/ContactForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Shown before anything has ever been saved, so the form is never rendered with empty
// required fields. Written in the site's voice rather than as lorem, because placeholder copy
// that reads like real copy is easier to judge and replace than "Lorem ipsum".
const CONTACT_DEFAULTS: ContactFormValues = {
  eyebrow: "Transmission",
  titleLine1: "Tell us what",
  titleLine2: "breaks today.",
  description:
    "Not a spec — a problem. We come back inside a week with a shape for it: what we would build, what we would refuse to build, and what it takes.",
  emailAddress: "hello@voidix.com",
  formNameLabel: "Your name",
  formEmailLabel: "Email",
  formMessageLabel: "What are you building?",
  submitLabel: "Send",
  successMessage: "Received. We'll come back to you inside a week.",
  errorMessage: "That didn't send. Try again, or email us directly.",
};

export default async function ContactPage() {
  const contact = await prisma.contactSection.findUnique({ where: { id: SINGLETON_ROW_ID } });

  return (
    <>
      <PageHeader
        eyebrow="Section 04"
        title="Contact"
        description="Every string the contact section and its form render."
      />

      {!contact && (
        <PageHeaderNote>
          The site has no Contact section yet — the navbar links to{" "}
          <code className="text-fg">#contact</code> and nothing is there. These fields are
          pre-filled with placeholder copy and are not saved until you press Save. Building the
          section itself is a developer task.
        </PageHeaderNote>
      )}

      <ContactForm contact={contact ?? CONTACT_DEFAULTS} />
    </>
  );
}

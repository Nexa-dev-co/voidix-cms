import {
  EnquiryFormEditor,
  type EnquiryFormValues,
} from "@/app/(panel)/(content)/enquiry-form/EnquiryFormEditor";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeaderNote } from "@/components/ui/PageHeaderNote";
import { SINGLETON_ROW_ID } from "@/lib/content/singleton";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// What EnquiryForm.tsx ships today, plus the two templates buildEnquiryPrefill applies.
const ENQUIRY_FORM_DEFAULTS: EnquiryFormValues = {
  nameLabel: "Name",
  emailLabel: "Email",
  phoneLabel: "Phone",
  sendingLabel: "Sending…",
  sentMessage: "Sent. You will hear back from a person, either way.",
  errorMessage: "That did not send. Try again in a moment.",
  referenceSubjectSuffix: " — like {project}",
  referenceBriefPrefix: "In the orbit of {project}. ",
};

export default async function EnquiryFormPage() {
  const [enquiryForm, disciplines] = await Promise.all([
    prisma.enquiryFormContent.findUnique({ where: { id: SINGLETON_ROW_ID } }),
    prisma.discipline.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Section 08"
        title="Enquiry form"
        description="The one form the whole site uses, and the subject each section's version arrives under."
      />

      <PageHeaderNote>
        <strong className="text-fg">This is one form in six places.</strong> The services deck,
        the works field, the FAQ hologram, the contact section, About and Careers all render it —
        so these strings are here rather than on any one of those pages. What each section
        overrides stays with that section: Contact and Careers name the long field differently
        because they ask a different question.
      </PageHeaderNote>

      <EnquiryFormEditor
        enquiryForm={
          enquiryForm
            ? {
                nameLabel: enquiryForm.nameLabel,
                emailLabel: enquiryForm.emailLabel,
                phoneLabel: enquiryForm.phoneLabel,
                sendingLabel: enquiryForm.sendingLabel,
                sentMessage: enquiryForm.sentMessage,
                errorMessage: enquiryForm.errorMessage,
                referenceSubjectSuffix: enquiryForm.referenceSubjectSuffix,
                referenceBriefPrefix: enquiryForm.referenceBriefPrefix,
              }
            : ENQUIRY_FORM_DEFAULTS
        }
        disciplines={disciplines.map((discipline) => ({
          key: discipline.key,
          label: discipline.label,
          briefSeed: discipline.briefSeed,
        }))}
      />
    </>
  );
}

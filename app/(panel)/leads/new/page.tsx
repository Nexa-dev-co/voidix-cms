import { NewContactForm } from "@/app/(panel)/leads/new/NewContactForm";
import ReadingColumn from "@/components/layout/ReadingColumn";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";

export default async function NewContactPage() {
  await requireMember();

  return (
    <ReadingColumn>
      <PageHeader
        eyebrow="Leads"
        title="Add a lead"
        description="Assigned to you automatically. If the email is already here, this is added to that person's history instead of creating a second record."
      />

      <NewContactForm />
    </ReadingColumn>
  );
}

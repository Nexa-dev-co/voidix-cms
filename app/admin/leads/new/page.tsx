import { NewContactForm } from "@/app/admin/leads/new/NewContactForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireMember } from "@/lib/auth";

export default async function NewContactPage() {
  await requireMember();

  return (
    <>
      <PageHeader
        eyebrow="Leads"
        title="Add a lead"
        description="Assigned to you automatically. If the email is already here, this is added to that person's history instead of creating a second record."
      />

      <NewContactForm />
    </>
  );
}

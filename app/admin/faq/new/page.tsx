import { FaqForm } from "@/app/admin/faq/FaqForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewFaqPage() {
  return (
    <>
      <PageHeader
        eyebrow="FAQ"
        title="Add a question"
        description="Nothing else has to be supplied — the hologram sizes itself around whatever you write."
      />

      <FaqForm />
    </>
  );
}

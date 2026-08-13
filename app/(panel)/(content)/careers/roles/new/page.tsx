import { RoleForm } from "@/app/(panel)/(content)/careers/RoleForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewRolePage() {
  return (
    <>
      <PageHeader
        eyebrow="Careers"
        title="Add role"
        description="A role posting is the one thing on this site a person can waste an afternoon on. Post it when the opening is real."
      />

      <RoleForm />
    </>
  );
}

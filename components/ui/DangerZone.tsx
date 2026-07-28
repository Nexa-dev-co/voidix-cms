import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";

export function DangerZone({
  id,
  deleteAction,
  title,
  description,
  confirmMessage,
  buttonLabel,
}: {
  id: string;
  deleteAction: (formData: FormData) => Promise<void>;
  title: string;
  description: string;
  confirmMessage: string;
  buttonLabel: string;
}) {
  return (
    <section className="mt-12 rounded-sm border border-danger/25 p-5">
      <h2 className="font-display text-sm font-bold text-danger">{title}</h2>
      <p className="mt-1.5 mb-4 max-w-lg text-xs leading-relaxed text-muted">{description}</p>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton confirmMessage={confirmMessage} pendingLabel="Deleting…">
          {buttonLabel}
        </ConfirmSubmitButton>
      </form>
    </section>
  );
}

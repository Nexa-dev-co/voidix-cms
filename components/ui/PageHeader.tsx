import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && (
          <div className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{description}</div>
        )}
      </div>
      {action}
    </header>
  );
}

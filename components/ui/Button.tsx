import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-bg hover:brightness-110 disabled:hover:brightness-100 font-medium",
  secondary:
    "border border-border-strong text-fg hover:border-accent hover:text-accent bg-transparent",
  ghost: "text-muted hover:text-fg bg-transparent",
  danger: "border border-danger/40 text-danger hover:bg-danger/10 bg-transparent",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm transition-[color,background-color,border-color,filter] duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

export function buttonClasses(variant: ButtonVariant = "secondary", className = "") {
  return `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim();
}

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button className={buttonClasses(variant, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  className = "",
  children,
  href,
}: {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}

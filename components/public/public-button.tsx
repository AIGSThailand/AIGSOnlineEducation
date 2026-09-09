/**
 * Public site link/button styles — AIGS brand tokens via CSS variables.
 * Prefer these over ad-hoc Tailwind reds on public pages.
 */

import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary:
    "bg-[var(--brand-primary)] px-5 py-2.5 text-white hover:bg-[var(--brand-primary-hover)]",
  secondary:
    "border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
  tertiary:
    "px-1 py-2 text-[var(--brand-primary)] underline-offset-4 hover:underline",
} as const;

export type PublicButtonVariant = keyof typeof variants;

export function publicButtonClassName(
  variant: PublicButtonVariant = "primary",
  className?: string
) {
  return cn(base, variants[variant], className);
}

type PublicLinkButtonProps = ComponentProps<typeof Link> & {
  variant?: PublicButtonVariant;
};

export function PublicLinkButton({
  variant = "primary",
  className,
  ...props
}: PublicLinkButtonProps) {
  return <Link className={publicButtonClassName(variant, className)} {...props} />;
}

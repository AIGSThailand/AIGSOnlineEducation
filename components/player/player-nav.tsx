"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlayerStep } from "@/features/player/types";

interface PlayerNavProps {
  prev: PlayerStep | null;
  next: PlayerStep | null;
  nextLocked: boolean;
}

export function PlayerNav({ prev, next, nextLocked }: PlayerNavProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      {prev ? (
        <Link
          href={prev.href}
          className={`${base} border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)]`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Link>
      ) : (
        <span />
      )}

      {next && !nextLocked ? (
        <Link
          href={next.href}
          className={`${base} bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]`}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}

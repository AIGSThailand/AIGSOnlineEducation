"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleStepCompleteAction } from "@/features/progress/actions";
import type { PlayerStep } from "@/features/player/types";

type PlayerCompleteButtonProps = {
  courseId: string;
  current: PlayerStep;
  completed: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

export function PlayerCompleteButton({
  courseId,
  current,
  completed,
  disabled = false,
  className,
  compact = false,
}: PlayerCompleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    if (disabled) return;
    setError(null);
    startTransition(async () => {
      const result = await toggleStepCompleteAction({
        courseId,
        kind: current.kind,
        contentId: current.contentId,
        stepId: current.stepId,
        completed: !completed,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || isPending}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:opacity-50",
          completed
            ? "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-hover)]",
          compact && "min-h-9 px-3 text-xs"
        )}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {isPending ? "Saving…" : completed ? "Completed" : "Mark Complete"}
      </button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

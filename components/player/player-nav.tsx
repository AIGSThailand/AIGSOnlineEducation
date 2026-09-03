"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleStepCompleteAction } from "@/features/progress/actions";
import type { PlayerStep } from "@/features/player/types";

interface PlayerNavProps {
  courseId: string;
  current: PlayerStep;
  prev: PlayerStep | null;
  next: PlayerStep | null;
  completed: boolean;
  nextLocked: boolean;
  canToggleComplete: boolean;
}

export function PlayerNav({
  courseId,
  current,
  prev,
  next,
  completed,
  nextLocked,
  canToggleComplete,
}: PlayerNavProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
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

  const navClass =
    "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {prev ? (
          <Link href={prev.href} className={navClass + " border border-slate-300 text-slate-700 hover:bg-slate-50"}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Link>
        ) : (
          <span />
        )}

        {canToggleComplete ? (
          <Button
            type="button"
            onClick={toggle}
            isLoading={isPending}
            variant={completed ? "outline" : "primary"}
            className={completed ? "border-emerald-300 text-emerald-800 hover:bg-emerald-50" : undefined}
          >
            <CheckCircle className="mr-1.5 h-4 w-4" />
            {completed ? "Mark Incomplete" : "Mark Complete"}
          </Button>
        ) : (
          <span />
        )}

        {next && !nextLocked ? (
          <Link
            href={next.href}
            className={navClass + " bg-brand-600 text-white hover:bg-brand-700"}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
      </div>
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}

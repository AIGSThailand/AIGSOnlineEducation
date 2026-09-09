"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Lock,
  Play,
} from "lucide-react";
import type { PlayerSection, PlayerStep } from "@/features/player/types";

interface PlayerSidebarProps {
  courseId: string;
  courseTitle: string;
  sections: PlayerSection[];
  currentKey: string;
  completedKeys: Set<string>;
  lockedKeys: Set<string>;
  onNavigate?: () => void;
}

function StatusIcon({
  locked,
  completed,
  active,
  isQuiz,
}: {
  locked: boolean;
  completed: boolean;
  active: boolean;
  isQuiz: boolean;
}) {
  if (locked) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
        <Lock className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  if (completed) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (active) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
        <Play className="h-3 w-3 fill-current" aria-hidden />
      </span>
    );
  }
  if (isQuiz) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--text-secondary)]">
        <ClipboardList className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface)]"
      aria-hidden
    />
  );
}

function StepRow({
  step,
  currentKey,
  completedKeys,
  lockedKeys,
  onNavigate,
}: {
  step: PlayerStep;
  currentKey: string;
  completedKeys: Set<string>;
  lockedKeys: Set<string>;
  onNavigate?: () => void;
}) {
  const isActive = step.key === currentKey;
  const isCompleted = completedKeys.has(step.key);
  const isLocked = lockedKeys.has(step.key);

  const inner = (
    <>
      <StatusIcon
        locked={isLocked}
        completed={isCompleted}
        active={isActive}
        isQuiz={step.kind === "quiz"}
      />
      <span className="min-w-0 flex-1 truncate leading-snug">{step.title}</span>
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
    step.nested && "ml-4",
    isActive && "bg-[var(--brand-primary-muted)] font-semibold text-[var(--brand-primary)]",
    !isActive && !isLocked && "text-[var(--text-primary)] hover:bg-[var(--surface-muted)]",
    isLocked && "cursor-not-allowed text-[var(--text-secondary)] opacity-70"
  );

  if (isLocked) {
    return (
      <span className={className} aria-disabled="true" aria-current={undefined}>
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={step.href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      {inner}
    </Link>
  );
}

export function PlayerSidebar({
  courseId,
  courseTitle,
  sections,
  currentKey,
  completedKeys,
  lockedKeys,
  onNavigate,
}: PlayerSidebarProps) {
  const currentSectionId = sections.find((section) =>
    section.items.some(
      (item) => item.key === currentKey || item.children.some((c) => c.key === currentKey)
    )
  )?.id;

  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(currentSectionId ? [currentSectionId] : sections[0] ? [sections[0].id] : [])
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav
      aria-label="Course syllabus"
      className="flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--surface)]"
    >
      <Link
        href={`/courses/${courseId}`}
        className="flex items-center gap-2 bg-[var(--brand-primary)] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
        onClick={onNavigate}
      >
        <ChevronRight className="h-4 w-4 rotate-180 opacity-80" aria-hidden />
        <span className="truncate">{courseTitle}</span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, index) => {
          const open = openIds.has(section.id);
          return (
            <div key={section.id} className="mb-3">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between gap-2 px-1 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                aria-expanded={open}
              >
                <span className="leading-snug">
                  {section.title?.trim() || `Section ${index + 1}`}
                </span>
                {open ? (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              {open ? (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <div key={item.key}>
                      <StepRow
                        step={item}
                        currentKey={currentKey}
                        completedKeys={completedKeys}
                        lockedKeys={lockedKeys}
                        onNavigate={onNavigate}
                      />
                      {item.children.map((child) => (
                        <StepRow
                          key={child.key}
                          step={child}
                          currentKey={currentKey}
                          completedKeys={completedKeys}
                          lockedKeys={lockedKeys}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

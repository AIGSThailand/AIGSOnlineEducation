"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Lock,
  PlayCircle,
} from "lucide-react";
import type { PlayerSection, PlayerStep } from "@/features/player/types";

interface PlayerSidebarProps {
  courseId: string;
  courseTitle: string;
  sections: PlayerSection[];
  currentKey: string;
  completedKeys: Set<string>;
  lockedKeys: Set<string>;
}

function StepRow({
  step,
  currentKey,
  completedKeys,
  lockedKeys,
}: {
  step: PlayerStep;
  currentKey: string;
  completedKeys: Set<string>;
  lockedKeys: Set<string>;
}) {
  const isActive = step.key === currentKey;
  const isCompleted = completedKeys.has(step.key);
  const isLocked = lockedKeys.has(step.key);

  const inner = (
    <>
      {isLocked ? (
        <Lock className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
      ) : isCompleted ? (
        <CheckCircle className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
      ) : isActive ? (
        <PlayCircle className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-brand-600" />
      ) : step.kind === "quiz" ? (
        <ClipboardList className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
      ) : (
        <Circle className="mr-2 h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
      )}
      <span className="truncate">{step.title}</span>
    </>
  );

  const className = cn(
    "flex items-center rounded px-2 py-1.5 text-xs font-medium",
    step.nested && "ml-4",
    isActive && "bg-brand-50 font-semibold text-brand-700",
    !isActive && !isLocked && "text-slate-700 hover:bg-slate-100",
    isLocked && "cursor-not-allowed text-slate-400"
  );

  if (isLocked) {
    return (
      <span className={className} aria-disabled="true">
        {inner}
      </span>
    );
  }

  return (
    <Link href={step.href} className={className}>
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
      className="flex h-full w-full flex-col border-r border-slate-200 bg-white"
    >
      <Link
        href={`/courses/${courseId}`}
        className="flex items-center bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <span className="truncate">{courseTitle}</span>
      </Link>

      <div className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => {
          const open = openIds.has(section.id);
          return (
            <div key={section.id} className="mb-2">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="flex w-full items-start justify-between gap-2 px-1 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800"
                aria-expanded={open}
              >
                <span className="leading-snug">{section.title}</span>
                {open ? (
                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                )}
              </button>
              {open && (
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <div key={item.key}>
                      <StepRow
                        step={item}
                        currentKey={currentKey}
                        completedKeys={completedKeys}
                        lockedKeys={lockedKeys}
                      />
                      {item.children.map((child) => (
                        <StepRow
                          key={child.key}
                          step={child}
                          currentKey={currentKey}
                          completedKeys={completedKeys}
                          lockedKeys={lockedKeys}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

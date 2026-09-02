"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CourseStructureLessonItem } from "@/features/courses/types";

interface StructureItemProps {
  title: string;
  kind: "module" | "lesson";
  selected?: boolean;
  expanded?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  depth?: number;
  actions?: React.ReactNode;
}

/** Reusable row for the course structure tree (extensible to topic/quiz). */
export function StructureItem({
  title,
  kind,
  selected,
  expanded,
  onSelect,
  onToggle,
  depth = 0,
  actions,
}: StructureItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1",
        selected ? "bg-brand-50" : "hover:bg-slate-50"
      )}
      style={{ paddingLeft: depth * 8 }}
    >
      {kind === "module" && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 truncate py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-md px-1"
      >
        {title}
      </button>
      {actions}
    </div>
  );
}

export function lessonItemFromRow(lesson: CourseStructureLessonItem & { moduleId?: string }) {
  return {
    kind: "lesson" as const,
    id: lesson.id,
    sectionId: lesson.sectionId,
    moduleId: lesson.moduleId ?? lesson.sectionId,
    title: lesson.title,
  };
}

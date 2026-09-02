"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CourseBuilderSelection,
  CourseStructureModuleItem,
  CurriculumItem,
  StructureItemType,
} from "@/features/courses/types";

export type SelectedItem = CourseBuilderSelection;

interface CourseStructureProps {
  structure: CourseStructureModuleItem[];
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
  onAddSection: () => void;
  onAddLesson: (sectionId: string) => void;
  onMoveSection: (sectionId: string, direction: "up" | "down") => void;
  onMoveLesson: (lessonId: string, direction: "up" | "down") => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  expandedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
}

export function CourseStructure({
  structure,
  selected,
  onSelect,
  onAddSection,
  onAddLesson,
  onMoveSection,
  onMoveLesson,
  onDeleteSection,
  onDeleteLesson,
  expandedSections,
  onToggleSection,
}: CourseStructureProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={() => onSelect({ type: "course" })}
          className={cn(
            "w-full rounded-md px-3 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500",
            selected.type === "course"
              ? "bg-brand-50 text-brand-800"
              : "text-slate-700 hover:bg-slate-50"
          )}
        >
          Course details
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Curriculum
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddSection}
          aria-label="Add section"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {structure.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-slate-500">
            <p>No sections yet.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAddSection}>
              Add section
            </Button>
          </div>
        ) : (
          <ul className="space-y-1" role="tree" aria-label="Course curriculum">
            {structure.map((section, sIdx) => {
              const expanded = expandedSections.has(section.id);
              const isSectionSelected =
                selected.type === "section" && selected.id === section.id;

              return (
                <li
                  key={section.id}
                  role="treeitem"
                  aria-expanded={expanded}
                  aria-selected={isSectionSelected}
                >
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md pr-1",
                      isSectionSelected ? "bg-brand-50" : "hover:bg-slate-50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleSection(section.id)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={expanded ? "Collapse section" : "Expand section"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: "section", id: section.id })}
                      className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-md px-1"
                    >
                      {section.title}
                    </button>
                    <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
                      <MoveButtons
                        onUp={() => onMoveSection(section.id, "up")}
                        onDown={() => onMoveSection(section.id, "down")}
                        disableUp={sIdx === 0}
                        disableDown={sIdx === structure.length - 1}
                        label={`Section ${section.title}`}
                      />
                      <IconButton
                        label={`Delete section ${section.title}`}
                        onClick={() => onDeleteSection(section.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>

                  {expanded && (
                    <ul className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-2" role="group">
                      {section.items.length === 0 && section.lessons.length === 0 ? (
                        <li className="px-2 py-2 text-xs text-slate-500">
                          No content yet.{" "}
                          <button
                            type="button"
                            className="text-brand-600 underline focus:outline-none focus:ring-2 focus:ring-brand-500"
                            onClick={() => onAddLesson(section.id)}
                          >
                            Add lesson
                          </button>
                        </li>
                      ) : (
                        renderSectionItems(section, selected, onSelect, onMoveLesson, onDeleteLesson)
                      )}
                      <li className="px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start text-xs"
                          onClick={() => onAddLesson(section.id)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add lesson
                        </Button>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddSection}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add section
        </Button>
      </div>
    </div>
  );
}

function renderSectionItems(
  section: CourseStructureModuleItem,
  selected: SelectedItem,
  onSelect: (item: SelectedItem) => void,
  onMoveLesson: (lessonId: string, direction: "up" | "down") => void,
  onDeleteLesson: (lessonId: string) => void
) {
  const items: CurriculumItem[] =
    section.items.length > 0
      ? section.items
      : section.lessons.map((l) => ({ ...l, kind: "lesson" as const }));

  const lessonItems = items.filter((i) => i.kind === "lesson");

  return items.map((item, idx) => {
    if (item.kind === "lesson") {
      const lessonIdx = lessonItems.findIndex((l) => l.id === item.id);
      const isLessonSelected = selected.type === "lesson" && selected.id === item.id;
      return (
        <li key={item.id}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md",
              isLessonSelected ? "bg-brand-50" : "hover:bg-slate-50"
            )}
          >
            <GripVertical className="ml-1 h-3 w-3 shrink-0 text-slate-300" aria-hidden />
            <button
              type="button"
              onClick={() =>
                onSelect({
                  type: "lesson",
                  id: item.id,
                  sectionId: section.id,
                })
              }
              className="min-w-0 flex-1 truncate py-1.5 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-md px-1"
            >
              {item.title}
            </button>
            <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
              <MoveButtons
                onUp={() => onMoveLesson(item.id, "up")}
                onDown={() => onMoveLesson(item.id, "down")}
                disableUp={lessonIdx <= 0}
                disableDown={lessonIdx >= lessonItems.length - 1}
                label={`Lesson ${item.title}`}
              />
              <IconButton
                label={`Delete lesson ${item.title}`}
                onClick={() => onDeleteLesson(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        </li>
      );
    }

    if (item.kind === "quiz" || item.kind === "exam") {
      const isQuizSelected =
        (selected.type === "quiz" || selected.type === "exam") && selected.id === item.id;
      return (
        <li key={item.id}>
          <button
            type="button"
            onClick={() =>
              onSelect({
                type: item.kind === "exam" ? "exam" : "quiz",
                id: item.id,
                sectionId: section.id,
              })
            }
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500",
              isQuizSelected ? "bg-brand-50 text-brand-900" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
            <span className="truncate">{item.title}</span>
            <span className="ml-auto text-[10px] uppercase text-slate-400">Quiz</span>
          </button>
        </li>
      );
    }

    return null;
  });
}

function MoveButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
  label,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  label: string;
}) {
  return (
    <>
      <IconButton label={`Move ${label} up`} onClick={onUp} disabled={disableUp}>
        <ChevronUp className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label={`Move ${label} down`} onClick={onDown} disabled={disableDown}>
        <ChevronDown className="h-3.5 w-3.5" />
      </IconButton>
    </>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {children}
    </button>
  );
}

export function itemTypeLabel(type: StructureItemType): string {
  switch (type) {
    case "section":
    case "module":
      return "Section";
    case "lesson":
      return "Lesson";
    case "quiz":
    case "exam":
      return "Quiz";
    default:
      return "Item";
  }
}

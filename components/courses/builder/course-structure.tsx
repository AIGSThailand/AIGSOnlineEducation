"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CourseStructureModuleItem,
  StructureItemType,
} from "@/features/courses/types";

export type SelectedItem =
  | { type: "course" }
  | { type: "module"; id: string }
  | { type: "lesson"; id: string; moduleId: string };

interface CourseStructureProps {
  structure: CourseStructureModuleItem[];
  selected: SelectedItem;
  onSelect: (item: SelectedItem) => void;
  onAddModule: () => void;
  onAddLesson: (moduleId: string) => void;
  onMoveModule: (moduleId: string, direction: "up" | "down") => void;
  onMoveLesson: (lessonId: string, direction: "up" | "down") => void;
  onDeleteModule: (moduleId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  expandedModules: Set<string>;
  onToggleModule: (moduleId: string) => void;
}

export function CourseStructure({
  structure,
  selected,
  onSelect,
  onAddModule,
  onAddLesson,
  onMoveModule,
  onMoveLesson,
  onDeleteModule,
  onDeleteLesson,
  expandedModules,
  onToggleModule,
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
          Course structure
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onAddModule} aria-label="Add module">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {structure.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-slate-500">
            <p>No modules yet.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onAddModule}>
              Add Module
            </Button>
          </div>
        ) : (
          <ul className="space-y-1" role="tree" aria-label="Course structure">
            {structure.map((module, mIdx) => {
              const expanded = expandedModules.has(module.id);
              const isModuleSelected = selected.type === "module" && selected.id === module.id;

              return (
                <li
                  key={module.id}
                  role="treeitem"
                  aria-expanded={expanded}
                  aria-selected={isModuleSelected}
                >
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-md pr-1",
                      isModuleSelected ? "bg-brand-50" : "hover:bg-slate-50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleModule(module.id)}
                      className="rounded p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      aria-label={expanded ? "Collapse module" : "Expand module"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: "module", id: module.id })}
                      className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-md px-1"
                    >
                      {module.title}
                    </button>
                    <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
                      <MoveButtons
                        onUp={() => onMoveModule(module.id, "up")}
                        onDown={() => onMoveModule(module.id, "down")}
                        disableUp={mIdx === 0}
                        disableDown={mIdx === structure.length - 1}
                        label={`Module ${module.title}`}
                      />
                      <IconButton
                        label={`Delete module ${module.title}`}
                        onClick={() => onDeleteModule(module.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>

                  {expanded && (
                    <ul className="ml-5 mt-1 space-y-0.5 border-l border-slate-200 pl-2" role="group">
                      {module.lessons.length === 0 ? (
                        <li className="px-2 py-2 text-xs text-slate-500">
                          No lessons yet.{" "}
                          <button
                            type="button"
                            className="text-brand-600 underline focus:outline-none focus:ring-2 focus:ring-brand-500"
                            onClick={() => onAddLesson(module.id)}
                          >
                            Add lesson
                          </button>
                        </li>
                      ) : (
                        module.lessons.map((lesson, lIdx) => {
                          const isLessonSelected =
                            selected.type === "lesson" && selected.id === lesson.id;
                          return (
                            <li key={lesson.id}>
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
                                      id: lesson.id,
                                      moduleId: module.id,
                                    })
                                  }
                                  className="min-w-0 flex-1 truncate py-1.5 text-left text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-md px-1"
                                >
                                  {lesson.title}
                                </button>
                                <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
                                  <MoveButtons
                                    onUp={() => onMoveLesson(lesson.id, "up")}
                                    onDown={() => onMoveLesson(lesson.id, "down")}
                                    disableUp={lIdx === 0}
                                    disableDown={lIdx === module.lessons.length - 1}
                                    label={`Lesson ${lesson.title}`}
                                  />
                                  <IconButton
                                    label={`Delete lesson ${lesson.title}`}
                                    onClick={() => onDeleteLesson(lesson.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </IconButton>
                                </div>
                              </div>
                            </li>
                          );
                        })
                      )}
                      <li className="px-1 py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full justify-start text-xs"
                          onClick={() => onAddLesson(module.id)}
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
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddModule}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add module
        </Button>
      </div>
    </div>
  );
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
    case "module":
    case "section":
      return "Module";
    case "lesson":
      return "Lesson";
    default:
      return "Item";
  }
}

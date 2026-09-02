"use client";

import type { CourseBuilderData, SaveStatus } from "@/features/courses/types";
import type { SelectedItem } from "./course-structure";
import { CourseDetailsForm } from "./course-details-form";
import { ModuleEditor } from "./module-editor";
import { LessonEditor } from "./lesson-editor";

interface ContentEditorProps {
  data: CourseBuilderData;
  selected: SelectedItem;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

export function ContentEditor({
  data,
  selected,
  onSaveStatusChange,
  saveSignal,
}: ContentEditorProps) {
  if (selected.type === "course") {
    return (
      <CourseDetailsForm
        course={data.course}
        onSaveStatusChange={onSaveStatusChange}
        saveSignal={saveSignal}
      />
    );
  }

  if (selected.type === "module") {
    const moduleItem = data.structure.find((m) => m.id === selected.id);
    if (!moduleItem) {
      return <p className="text-sm text-slate-500">Module not found.</p>;
    }
    return (
      <ModuleEditor
        courseId={data.course.id}
        module={moduleItem}
        onSaveStatusChange={onSaveStatusChange}
        saveSignal={saveSignal}
      />
    );
  }

  return (
    <LessonEditor
      courseId={data.course.id}
      lessonId={selected.id}
      moduleId={selected.moduleId}
      onSaveStatusChange={onSaveStatusChange}
      saveSignal={saveSignal}
    />
  );
}

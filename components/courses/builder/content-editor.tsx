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

  if (selected.type === "section") {
    const section = data.structure.find((s) => s.id === selected.id);
    if (!section) {
      return <p className="text-sm text-slate-500">Section not found.</p>;
    }
    return (
      <ModuleEditor
        courseId={data.course.id}
        module={section}
        onSaveStatusChange={onSaveStatusChange}
        saveSignal={saveSignal}
      />
    );
  }

  if (selected.type === "quiz" || selected.type === "exam") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Quiz editor</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quiz and exam editing is planned for Phase 5. Migrated LearnDash quizzes appear in the
          curriculum tree and remain available to students via course steps.
        </p>
        <p className="mt-4 text-xs text-slate-400">Quiz ID: {selected.id}</p>
      </div>
    );
  }

  const sectionId = selected.sectionId;
  return (
    <LessonEditor
      courseId={data.course.id}
      lessonId={selected.id}
      moduleId={sectionId}
      onSaveStatusChange={onSaveStatusChange}
      saveSignal={saveSignal}
    />
  );
}

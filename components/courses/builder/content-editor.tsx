"use client";

import type { CourseBuilderData, SaveStatus } from "@/features/courses/types";
import type { SelectedItem } from "./course-structure";
import { CourseDetailsForm } from "./course-details-form";
import { ModuleEditor } from "./module-editor";
import { LessonEditor } from "./lesson-editor";
import { QuizEditor } from "./quiz-editor";

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
      <QuizEditor
        courseId={data.course.id}
        quizId={selected.id}
        onSaveStatusChange={onSaveStatusChange}
        saveSignal={saveSignal}
      />
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

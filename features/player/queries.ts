import { createClient } from "@/lib/supabase/server";
import {
  buildPlayerFromModules,
  buildPlayerFromSteps,
} from "./build-player";
import type { CoursePlayerData, StepRow } from "./types";
import type { Database } from "@/types/database.types";

type LessonMeta = {
  id: string;
  title: string;
  module_id: string | null;
  sort_order: number;
};

type QuizMeta = { id: string; title: string };

const IN_CHUNK = 100;

async function loadByIds<T extends { id: string }>(
  table: "lessons" | "quizzes",
  ids: string[],
  columns: string
): Promise<T[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const unique = Array.from(new Set(ids));
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const { data } = await supabase
      .from(table)
      .select(columns)
      .in("id", unique.slice(i, i + IN_CHUNK));
    rows.push(...((data as T[] | null) || []));
  }
  return rows;
}

function completedKeySet(
  flatSteps: CoursePlayerData["flatSteps"],
  stepProgress: Map<string, boolean>,
  lessonProgress: Map<string, boolean>
): string[] {
  const keys: string[] = [];
  for (const step of flatSteps) {
    let done = false;
    if (step.stepId && stepProgress.has(step.stepId)) {
      done = stepProgress.get(step.stepId) === true;
    } else if (step.kind === "lesson") {
      done = lessonProgress.get(step.contentId) === true;
    }
    if (done) keys.push(step.key);
  }
  return keys;
}

export async function getCoursePlayerData(
  courseId: string,
  studentId: string
): Promise<CoursePlayerData | null> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, progression_type")
    .eq("id", courseId)
    .maybeSingle<{
      id: string;
      title: string;
      progression_type: Database["public"]["Tables"]["courses"]["Row"]["progression_type"];
    }>();

  if (!course) return null;

  const { data: courseSections } = await supabase
    .from("course_sections")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<{ id: string; title: string; sort_order: number }[]>();

  let sections;
  let flatSteps;

  if (courseSections && courseSections.length > 0) {
    const { data: steps } = await supabase
      .from("course_steps")
      .select(
        "id, course_id, step_type, lesson_id, quiz_id, section_id, parent_step_id, sort_order"
      )
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<StepRow[]>();

    const lessonIds = (steps || []).filter((s) => s.lesson_id).map((s) => s.lesson_id as string);
    const quizIds = (steps || []).filter((s) => s.quiz_id).map((s) => s.quiz_id as string);

    const lessons = await loadByIds<LessonMeta>(
      "lessons",
      lessonIds,
      "id, title, module_id, sort_order"
    );
    const quizzes = await loadByIds<QuizMeta>("quizzes", quizIds, "id, title");

    const lessonsById = new Map(lessons.map((l) => [l.id, l]));
    const quizzesById = new Map(quizzes.map((q) => [q.id, q]));

    const built = buildPlayerFromSteps(
      courseId,
      courseSections,
      steps || [],
      lessonsById,
      quizzesById
    );
    sections = built.sections;
    flatSteps = built.flatSteps;
  } else {
    const { data: modules } = await supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<{ id: string; title: string; sort_order: number }[]>();

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, title, module_id, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<LessonMeta[]>();

    const built = buildPlayerFromModules(courseId, modules || [], lessons || []);
    sections = built.sections;
    flatSteps = built.flatSteps;
  }

  const stepIds = flatSteps.filter((s) => s.stepId).map((s) => s.stepId as string);
  const lessonIds = flatSteps.filter((s) => s.kind === "lesson").map((s) => s.contentId);

  const stepProgress = new Map<string, boolean>();
  for (let i = 0; i < stepIds.length; i += IN_CHUNK) {
    const { data } = await supabase
      .from("step_progress")
      .select("course_step_id, completed")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .in("course_step_id", stepIds.slice(i, i + IN_CHUNK))
      .returns<{ course_step_id: string; completed: boolean }[]>();
    for (const row of data || []) {
      stepProgress.set(row.course_step_id, row.completed);
    }
  }

  const lessonProgress = new Map<string, boolean>();
  for (let i = 0; i < lessonIds.length; i += IN_CHUNK) {
    const { data } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .in("lesson_id", lessonIds.slice(i, i + IN_CHUNK))
      .returns<{ lesson_id: string; completed: boolean }[]>();
    for (const row of data || []) {
      lessonProgress.set(row.lesson_id, row.completed);
    }
  }

  return {
    courseId: course.id,
    courseTitle: course.title,
    progressionType: course.progression_type,
    sections,
    flatSteps,
    completedKeys: completedKeySet(flatSteps, stepProgress, lessonProgress),
  };
}

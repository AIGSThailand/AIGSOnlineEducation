import { createClient } from "@/lib/supabase/server";
import { builderSelectionToSearchParams } from "@/features/curriculum/types";

export type AdminCurriculumRow = {
  id: string;
  title: string;
  status: string;
  courseTitle: string;
  meta: string;
  editHref: string | null;
};

type QuizStep = { quiz_id: string | null; course_id: string; section_id: string | null };
type QuizRow = { id: string; title: string; status: string; passing_percentage: number };
type CourseTitle = { id: string; title: string };
type QuestionLink = { quiz_id: string };
type AssignmentLesson = { id: string; title: string; status: string; course_id: string };
type LessonStep = { lesson_id: string | null; section_id: string | null };

function builderHref(
  courseId: string,
  selection:
    | { type: "quiz"; id: string; sectionId: string }
    | { type: "lesson"; id: string; sectionId: string }
) {
  const params = builderSelectionToSearchParams(selection);
  const query = params.toString();
  return `/admin/courses/${courseId}/edit${query ? `?${query}` : ""}`;
}

async function courseTitles(ids: string[]) {
  const supabase = await createClient();
  const map = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("courses")
      .select("id, title")
      .in("id", slice)
      .returns<CourseTitle[]>();
    if (error) throw new Error(error.message);
    for (const row of data ?? []) map.set(row.id, row.title);
  }
  return map;
}

export async function countAdminQuizzes() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quizzes")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countAdminAssignments() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .filter("completion_type", "eq", "assignment_submit");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listAdminQuizzes(): Promise<AdminCurriculumRow[]> {
  const supabase = await createClient();
  const { data: steps, error } = await supabase
    .from("course_steps")
    .select("quiz_id, course_id, section_id")
    .eq("step_type", "quiz")
    .returns<QuizStep[]>();
  if (error) throw new Error(error.message);

  const placed = (steps ?? []).filter(
    (step): step is QuizStep & { quiz_id: string } => Boolean(step.quiz_id)
  );
  const quizIds = Array.from(new Set(placed.map((step) => step.quiz_id)));
  const courseIds = Array.from(new Set(placed.map((step) => step.course_id)));
  const [quizzes, courses, questionCounts] = await Promise.all([
    loadQuizzes(quizIds),
    courseTitles(courseIds),
    countQuestions(quizIds),
  ]);

  const rows = placed.map((step) => {
    const quiz = quizzes.get(step.quiz_id);
    const questions = questionCounts.get(step.quiz_id) ?? 0;
    return {
      id: `${step.course_id}:${step.quiz_id}`,
      title: quiz?.title || "Untitled quiz",
      status: quiz?.status || "draft",
      courseTitle: courses.get(step.course_id) || "Untitled course",
      meta: `${questions} ${questions === 1 ? "question" : "questions"} · pass ${quiz?.passing_percentage ?? 0}%`,
      editHref: builderHref(step.course_id, {
        type: "quiz",
        id: step.quiz_id,
        sectionId: step.section_id ?? "",
      }),
    };
  });

  rows.sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.title.localeCompare(b.title));
  return rows;
}

async function loadQuizzes(ids: string[]) {
  const supabase = await createClient();
  const map = new Map<string, QuizRow>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("quizzes")
      .select("id, title, status, passing_percentage")
      .in("id", slice)
      .returns<QuizRow[]>();
    if (error) throw new Error(error.message);
    for (const row of data ?? []) map.set(row.id, row);
  }
  return map;
}

async function countQuestions(quizIds: string[]) {
  const supabase = await createClient();
  const counts = new Map<string, number>();
  for (let i = 0; i < quizIds.length; i += 200) {
    const slice = quizIds.slice(i, i + 200);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("quiz_id")
      .in("quiz_id", slice)
      .returns<QuestionLink[]>();
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      counts.set(row.quiz_id, (counts.get(row.quiz_id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function listAdminAssignments(): Promise<AdminCurriculumRow[]> {
  const supabase = await createClient();
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, title, status, course_id")
    .filter("completion_type", "eq", "assignment_submit")
    .order("title")
    .returns<AssignmentLesson[]>();
  if (error) throw new Error(error.message);

  const rows = lessons ?? [];
  const lessonIds = rows.map((lesson) => lesson.id);
  const courseIds = Array.from(new Set(rows.map((lesson) => lesson.course_id)));
  const [courses, sections] = await Promise.all([courseTitles(courseIds), sectionByLesson(lessonIds)]);

  return rows
    .map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      courseTitle: courses.get(lesson.course_id) || "Untitled course",
      meta: "Completes when the assignment is submitted",
      editHref: builderHref(lesson.course_id, {
        type: "lesson",
        id: lesson.id,
        sectionId: sections.get(lesson.id) ?? "",
      }),
    }))
    .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle) || a.title.localeCompare(b.title));
}

async function sectionByLesson(lessonIds: string[]) {
  const supabase = await createClient();
  const map = new Map<string, string>();
  for (let i = 0; i < lessonIds.length; i += 200) {
    const slice = lessonIds.slice(i, i + 200);
    if (slice.length === 0) continue;
    const { data, error } = await supabase
      .from("course_steps")
      .select("lesson_id, section_id")
      .eq("step_type", "lesson")
      .in("lesson_id", slice)
      .returns<LessonStep[]>();
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.lesson_id && row.section_id && !map.has(row.lesson_id)) {
        map.set(row.lesson_id, row.section_id);
      }
    }
  }
  return map;
}

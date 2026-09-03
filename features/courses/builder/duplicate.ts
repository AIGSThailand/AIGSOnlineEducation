import type { SupabaseClient } from "@supabase/supabase-js";
import { nextSortOrder, slugifyTitle } from "@/features/courses/builder/ordering";
import {
  getNextTopLevelStepSortOrder,
  syncLessonToStep,
  syncModuleToSection,
} from "@/features/courses/builder/sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

async function uniqueLessonSlug(supabase: Db, courseId: string, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (true) {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("slug", slug);
    if ((count ?? 0) === 0) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

async function uniqueQuizSlug(supabase: Db, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (true) {
    const { count } = await supabase
      .from("quizzes")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    if ((count ?? 0) === 0) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export async function duplicateLessonRecord(
  supabase: Db,
  courseId: string,
  sectionId: string,
  lessonId: string
): Promise<string> {
  const { data: source } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle<{
      title: string;
      slug: string;
      content: string | null;
      video_url: string | null;
      status: string;
    }>();

  if (!source) throw new Error("Lesson not found.");

  const { data: sectionLessons } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("module_id", sectionId)
    .returns<{ id: string; sort_order: number }[]>();

  const sortOrder = nextSortOrder(
    (sectionLessons || []).map((l) => ({ id: l.id, sortOrder: l.sort_order }))
  );

  const slug = await uniqueLessonSlug(supabase, courseId, slugifyTitle(`${source.slug}-copy`));

  const { data: created, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      module_id: sectionId,
      title: `${source.title} (Copy)`,
      slug,
      content: source.content,
      video_url: source.video_url,
      sort_order: sortOrder,
      status: source.status || "draft",
    } as never)
    .select("id, course_id, module_id, sort_order")
    .single<{ id: string; course_id: string; module_id: string; sort_order: number }>();

  if (error || !created) throw new Error(error?.message || "Failed to duplicate lesson.");

  await syncLessonToStep(supabase, created);
  return created.id;
}

export async function duplicateQuizRecord(
  supabase: Db,
  courseId: string,
  sectionId: string,
  quizId: string
): Promise<string> {
  const { data: source } = await supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle<{
    title: string;
    slug: string;
    description: string | null;
    status: string;
    passing_percentage: number;
    time_limit_seconds: number | null;
    max_attempts: number | null;
    require_all_questions: boolean;
    randomize_questions: boolean;
  }>();

  if (!source) throw new Error("Quiz not found.");

  const slug = await uniqueQuizSlug(supabase, slugifyTitle(`${source.slug}-copy`));

  const { data: newQuiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      title: `${source.title} (Copy)`,
      slug,
      description: source.description,
      status: source.status,
      passing_percentage: source.passing_percentage,
      time_limit_seconds: source.time_limit_seconds,
      max_attempts: source.max_attempts,
      require_all_questions: source.require_all_questions,
      randomize_questions: source.randomize_questions,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (quizErr || !newQuiz) throw new Error(quizErr?.message || "Failed to duplicate quiz.");

  const { data: quizQuestions } = await supabase
    .from("quiz_questions")
    .select("sort_order, points_override, question_id")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true })
    .returns<{ sort_order: number; points_override: number | null; question_id: string }[]>();

  for (const qq of quizQuestions || []) {
    const { data: question } = await supabase
      .from("questions")
      .select("*")
      .eq("id", qq.question_id)
      .maybeSingle<{
        title: string | null;
        question_text: string;
        question_type: string;
        default_points: number;
        explanation: string | null;
      }>();

    if (!question) continue;

    const { data: newQuestion, error: qErr } = await supabase
      .from("questions")
      .insert({
        title: question.title,
        question_text: question.question_text,
        question_type: question.question_type,
        default_points: question.default_points,
        explanation: question.explanation,
      } as never)
      .select("id")
      .single<{ id: string }>();

    if (qErr || !newQuestion) throw new Error(qErr?.message || "Failed to duplicate question.");

    const { data: options } = await supabase
      .from("question_options")
      .select("answer_text, is_correct, sort_order, feedback")
      .eq("question_id", qq.question_id)
      .order("sort_order", { ascending: true })
      .returns<
        { answer_text: string; is_correct: boolean; sort_order: number; feedback: string | null }[]
      >();

    for (const opt of options || []) {
      const { error: optErr } = await supabase.from("question_options").insert({
        question_id: newQuestion.id,
        answer_text: opt.answer_text,
        is_correct: opt.is_correct,
        sort_order: opt.sort_order,
        feedback: opt.feedback,
      } as never);
      if (optErr) throw new Error(optErr.message);
    }

    const { error: linkErr } = await supabase.from("quiz_questions").insert({
      quiz_id: newQuiz.id,
      question_id: newQuestion.id,
      sort_order: qq.sort_order,
      points_override: qq.points_override,
    } as never);
    if (linkErr) throw new Error(linkErr.message);
  }

  const sortOrder = await getNextTopLevelStepSortOrder(supabase, courseId);
  const { error: stepErr } = await supabase.from("course_steps").insert({
    course_id: courseId,
    step_type: "quiz",
    quiz_id: newQuiz.id,
    lesson_id: null,
    topic_id: null,
    parent_step_id: null,
    section_id: sectionId,
    sort_order: sortOrder,
    is_required: true,
  } as never);

  if (stepErr) throw new Error(stepErr.message);

  return newQuiz.id;
}

export async function duplicateSectionRecord(
  supabase: Db,
  courseId: string,
  sectionId: string
): Promise<string> {
  const { data: sourceModule } = await supabase
    .from("modules")
    .select("id, title, sort_order")
    .eq("id", sectionId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string; title: string; sort_order: number }>();

  if (!sourceModule) throw new Error("Section not found.");

  const { data: allModules } = await supabase
    .from("modules")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .returns<{ id: string; sort_order: number }[]>();

  const sortOrder = nextSortOrder(
    (allModules || []).map((m) => ({ id: m.id, sortOrder: m.sort_order }))
  );

  const { data: newModule, error } = await supabase
    .from("modules")
    .insert({
      course_id: courseId,
      title: `${sourceModule.title} (Copy)`,
      sort_order: sortOrder,
    } as never)
    .select("id, course_id, title, sort_order")
    .single<{ id: string; course_id: string; title: string; sort_order: number }>();

  if (error || !newModule) throw new Error(error?.message || "Failed to duplicate section.");

  await syncModuleToSection(supabase, newModule);

  const { data: sourceSection } = await supabase
    .from("course_sections")
    .select("description")
    .eq("id", sectionId)
    .maybeSingle<{ description: string | null }>();

  if (sourceSection?.description) {
    await supabase
      .from("course_sections")
      .update({ description: sourceSection.description } as never)
      .eq("id", newModule.id);
  }

  const { data: steps } = await supabase
    .from("course_steps")
    .select("step_type, lesson_id, quiz_id, sort_order")
    .eq("course_id", courseId)
    .eq("section_id", sectionId)
    .is("parent_step_id", null)
    .order("sort_order", { ascending: true })
    .returns<
      {
        step_type: string;
        lesson_id: string | null;
        quiz_id: string | null;
        sort_order: number;
      }[]
    >();

  if (steps && steps.length > 0) {
    for (const step of steps) {
      if (step.step_type === "lesson" && step.lesson_id) {
        await duplicateLessonRecord(supabase, courseId, newModule.id, step.lesson_id);
      } else if (step.step_type === "quiz" && step.quiz_id) {
        await duplicateQuizRecord(supabase, courseId, newModule.id, step.quiz_id);
      }
    }
  } else {
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("module_id", sectionId)
      .order("sort_order", { ascending: true })
      .returns<{ id: string }[]>();

    for (const lesson of lessons || []) {
      await duplicateLessonRecord(supabase, courseId, newModule.id, lesson.id);
    }
  }

  return newModule.id;
}

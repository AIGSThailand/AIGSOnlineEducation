"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";
import type { ActionResult } from "@/features/courses/types";
import {
  deleteQuizQuestionSchema,
  reorderQuizQuestionSchema,
  updateQuizSchema,
  upsertQuizQuestionSchema,
} from "@/features/quizzes/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = Awaited<ReturnType<typeof createClient>>;

export type QuizOptionForEdit = {
  id: string;
  answerText: string;
  isCorrect: boolean;
  sortOrder: number;
  feedback: string | null;
};

export type QuizQuestionForEdit = {
  id: string;
  title: string | null;
  questionText: string;
  questionType: string;
  defaultPoints: number;
  explanation: string | null;
  sortOrder: number;
  pointsOverride: number | null;
  wordpressQuestionId: number | null;
  options: QuizOptionForEdit[];
};

export type QuizForEdit = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  passingPercentage: number;
  timeLimitSeconds: number | null;
  maxAttempts: number | null;
  requireAllQuestions: boolean;
  randomizeQuestions: boolean;
  wordpressQuizId: number | null;
  questions: QuizQuestionForEdit[];
};

function revalidateBuilder(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
}

/** Ensure this quiz is placed on the given course via course_steps. */
async function assertQuizOnCourse(
  supabase: Db,
  courseId: string,
  quizId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("course_steps")
    .select("id")
    .eq("course_id", courseId)
    .eq("quiz_id", quizId)
    .eq("step_type", "quiz")
    .maybeSingle<{ id: string }>();
  return Boolean(data?.id);
}

async function quizSlugTaken(supabase: Db, slug: string, excludeQuizId: string): Promise<boolean> {
  const { count } = await supabase
    .from("quizzes")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug)
    .neq("id", excludeQuizId);
  return (count ?? 0) > 0;
}

export async function getQuizForEdit(
  courseId: string,
  quizId: string
): Promise<ActionResult<QuizForEdit>> {
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertQuizOnCourse(supabase, courseId, quizId))) {
    return { success: false, error: "Quiz not found on this course." };
  }

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .maybeSingle<{
      id: string;
      title: string;
      slug: string;
      description: string | null;
      status: string;
      passing_percentage: number;
      time_limit_seconds: number | null;
      max_attempts: number | null;
      require_all_questions: boolean;
      randomize_questions: boolean;
      wordpress_quiz_id: number | null;
    }>();

  if (quizError || !quiz) {
    return { success: false, error: quizError?.message || "Quiz not found." };
  }

  const { data: links, error: linksError } = await supabase
    .from("quiz_questions")
    .select("id, question_id, sort_order, points_override")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true })
    .returns<
      Array<{
        id: string;
        question_id: string;
        sort_order: number;
        points_override: number | null;
      }>
    >();

  if (linksError) {
    return { success: false, error: linksError.message };
  }

  const questionIds = (links || []).map((l) => l.question_id);
  let questionsById = new Map<
    string,
    {
      id: string;
      title: string | null;
      question_text: string;
      question_type: string;
      default_points: number;
      explanation: string | null;
      wordpress_question_id: number | null;
    }
  >();

  if (questionIds.length > 0) {
    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select(
        "id, title, question_text, question_type, default_points, explanation, wordpress_question_id"
      )
      .in("id", questionIds)
      .returns<
        Array<{
          id: string;
          title: string | null;
          question_text: string;
          question_type: string;
          default_points: number;
          explanation: string | null;
          wordpress_question_id: number | null;
        }>
      >();
    if (qErr) return { success: false, error: qErr.message };
    questionsById = new Map((questions || []).map((q) => [q.id, q]));
  }

  const optionsByQuestion = new Map<string, QuizOptionForEdit[]>();
  if (questionIds.length > 0) {
    const { data: options, error: oErr } = await supabase
      .from("question_options")
      .select("id, question_id, answer_text, is_correct, sort_order, feedback")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true })
      .returns<
        Array<{
          id: string;
          question_id: string;
          answer_text: string;
          is_correct: boolean;
          sort_order: number;
          feedback: string | null;
        }>
      >();
    if (oErr) return { success: false, error: oErr.message };
    for (const opt of options || []) {
      const list = optionsByQuestion.get(opt.question_id) || [];
      list.push({
        id: opt.id,
        answerText: opt.answer_text,
        isCorrect: opt.is_correct,
        sortOrder: opt.sort_order,
        feedback: opt.feedback,
      });
      optionsByQuestion.set(opt.question_id, list);
    }
  }

  const questions: QuizQuestionForEdit[] = (links || [])
    .map((link) => {
      const q = questionsById.get(link.question_id);
      if (!q) return null;
      return {
        id: q.id,
        title: q.title,
        questionText: q.question_text,
        questionType: q.question_type,
        defaultPoints: q.default_points,
        explanation: q.explanation,
        sortOrder: link.sort_order,
        pointsOverride: link.points_override,
        wordpressQuestionId: q.wordpress_question_id,
        options: optionsByQuestion.get(q.id) || [],
      };
    })
    .filter((q): q is QuizQuestionForEdit => q != null);

  return {
    success: true,
    data: {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      description: quiz.description,
      status: quiz.status,
      passingPercentage: quiz.passing_percentage,
      timeLimitSeconds: quiz.time_limit_seconds,
      maxAttempts: quiz.max_attempts,
      requireAllQuestions: quiz.require_all_questions,
      randomizeQuestions: quiz.randomize_questions,
      wordpressQuizId: quiz.wordpress_quiz_id,
      questions,
    },
  };
}

export async function updateQuizAction(input: unknown): Promise<ActionResult> {
  const parsed = updateQuizSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid quiz data." };
  }

  const data = parsed.data;
  if (!(await canManageCourse(data.courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertQuizOnCourse(supabase, data.courseId, data.quizId))) {
    return { success: false, error: "Quiz not found on this course." };
  }

  if (await quizSlugTaken(supabase, data.slug, data.quizId)) {
    return { success: false, error: "This quiz slug is already in use." };
  }

  const { error } = await supabase
    .from("quizzes")
    .update({
      title: data.title,
      slug: data.slug,
      description: data.description || null,
      status: data.status,
      passing_percentage: data.passingPercentage,
      time_limit_seconds: data.timeLimitSeconds ?? null,
      max_attempts: data.maxAttempts ?? null,
      require_all_questions: data.requireAllQuestions,
      randomize_questions: data.randomizeQuestions,
    } as never)
    .eq("id", data.quizId);

  if (error) return { success: false, error: error.message };

  revalidateBuilder(data.courseId);
  return { success: true };
}

function validateOptionsForType(
  questionType: string,
  options: Array<{ answerText: string; isCorrect: boolean }>
): string | null {
  if (questionType === "essay" || questionType === "fill_blank" || questionType === "assessment") {
    return null;
  }
  if (options.length < 2) {
    return "Choice questions need at least two options.";
  }
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (questionType === "single_choice" || questionType === "true_false") {
    if (correctCount !== 1) return "Exactly one option must be marked correct.";
  }
  if (questionType === "multiple_choice" && correctCount < 1) {
    return "At least one option must be marked correct.";
  }
  return null;
}

export async function upsertQuizQuestionAction(
  input: unknown
): Promise<ActionResult<{ questionId: string }>> {
  const parsed = upsertQuizQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid question data." };
  }

  const data = parsed.data;
  if (!(await canManageCourse(data.courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const optionError = validateOptionsForType(data.questionType, data.options);
  if (optionError) return { success: false, error: optionError };

  const supabase = await createClient();
  if (!(await assertQuizOnCourse(supabase, data.courseId, data.quizId))) {
    return { success: false, error: "Quiz not found on this course." };
  }

  let questionId = data.questionId;

  if (questionId) {
    const { data: link } = await supabase
      .from("quiz_questions")
      .select("id")
      .eq("quiz_id", data.quizId)
      .eq("question_id", questionId)
      .maybeSingle();
    if (!link) return { success: false, error: "Question is not linked to this quiz." };

    const { error } = await supabase
      .from("questions")
      .update({
        title: data.title || null,
        question_text: data.questionText,
        question_type: data.questionType,
        default_points: data.defaultPoints,
        explanation: data.explanation || null,
      } as never)
      .eq("id", questionId);
    if (error) return { success: false, error: error.message };

    await supabase
      .from("quiz_questions")
      .update({ points_override: data.pointsOverride ?? null } as never)
      .eq("quiz_id", data.quizId)
      .eq("question_id", questionId);
  } else {
    const { data: existingLinks } = await supabase
      .from("quiz_questions")
      .select("sort_order")
      .eq("quiz_id", data.quizId)
      .returns<Array<{ sort_order: number }>>();
    const nextOrder =
      (existingLinks || []).reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

    const { data: created, error } = await supabase
      .from("questions")
      .insert({
        title: data.title || null,
        question_text: data.questionText,
        question_type: data.questionType,
        default_points: data.defaultPoints,
        explanation: data.explanation || null,
      } as never)
      .select("id")
      .single<{ id: string }>();
    if (error || !created) {
      return { success: false, error: error?.message || "Failed to create question." };
    }
    questionId = created.id;

    const { error: linkErr } = await supabase.from("quiz_questions").insert({
      quiz_id: data.quizId,
      question_id: questionId,
      sort_order: nextOrder,
      points_override: data.pointsOverride ?? null,
    } as never);
    if (linkErr) return { success: false, error: linkErr.message };
  }

  // Replace options for choice-style questions; clear for essay-like types.
  await supabase.from("question_options").delete().eq("question_id", questionId);

  if (
    data.questionType === "single_choice" ||
    data.questionType === "multiple_choice" ||
    data.questionType === "true_false"
  ) {
    const rows = data.options.map((opt, index) => ({
      question_id: questionId!,
      answer_text: opt.answerText,
      is_correct: opt.isCorrect,
      sort_order: opt.sortOrder ?? index,
      feedback: opt.feedback || null,
    }));
    if (rows.length > 0) {
      const { error: optErr } = await supabase.from("question_options").insert(rows as never);
      if (optErr) return { success: false, error: optErr.message };
    }
  }

  revalidateBuilder(data.courseId);
  return { success: true, data: { questionId: questionId! } };
}

export async function deleteQuizQuestionAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteQuizQuestionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, quizId, questionId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertQuizOnCourse(supabase, courseId, quizId))) {
    return { success: false, error: "Quiz not found on this course." };
  }

  const { error: unlinkErr } = await supabase
    .from("quiz_questions")
    .delete()
    .eq("quiz_id", quizId)
    .eq("question_id", questionId);
  if (unlinkErr) return { success: false, error: unlinkErr.message };

  // Delete question only if not linked to other quizzes and not from WordPress (safer: only if orphan).
  const { count } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);

  if ((count ?? 0) === 0) {
    const { data: q } = await supabase
      .from("questions")
      .select("wordpress_question_id")
      .eq("id", questionId)
      .maybeSingle<{ wordpress_question_id: number | null }>();
    // Prefer delete orphan authored questions; keep WP-linked rows for migration integrity.
    if (!q?.wordpress_question_id) {
      await supabase.from("question_options").delete().eq("question_id", questionId);
      await supabase.from("questions").delete().eq("id", questionId);
    }
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function reorderQuizQuestionAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderQuizQuestionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, quizId, questionId, direction } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertQuizOnCourse(supabase, courseId, quizId))) {
    return { success: false, error: "Quiz not found on this course." };
  }

  const { data: links } = await supabase
    .from("quiz_questions")
    .select("id, question_id, sort_order")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ id: string; question_id: string; sort_order: number }>>();

  const sorted = [...(links || [])].sort((a, b) => a.sort_order - b.sort_order);
  const index = sorted.findIndex((l) => l.question_id === questionId);
  if (index < 0) return { success: false, error: "Question not found." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sorted.length) return { success: true };

  const a = sorted[index];
  const b = sorted[swapIndex];
  const { error: e1 } = await supabase
    .from("quiz_questions")
    .update({ sort_order: b.sort_order } as never)
    .eq("id", a.id);
  const { error: e2 } = await supabase
    .from("quiz_questions")
    .update({ sort_order: a.sort_order } as never)
    .eq("id", b.id);

  if (e1 || e2) return { success: false, error: e1?.message || e2?.message || "Reorder failed." };

  revalidateBuilder(courseId);
  return { success: true };
}

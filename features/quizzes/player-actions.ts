"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canAccessCourse, getCurrentUser } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";
import type { ActionResult } from "@/features/curriculum/types";
import {
  startQuizAttemptSchema,
  submitQuizAttemptSchema,
  type SubmitQuizAttemptInput,
} from "@/features/quizzes/player-schema";

export type QuizPlayOption = {
  id: string;
  answerText: string;
  sortOrder: number;
};

export type QuizPlayQuestion = {
  id: string;
  title: string | null;
  questionText: string;
  questionType: string;
  points: number;
  sortOrder: number;
  options: QuizPlayOption[];
};

export type QuizAttemptSummary = {
  id: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  percentage: number | null;
  passed: boolean | null;
  pointsEarned: number | null;
  pointsPossible: number | null;
};

export type QuizForPlay = {
  id: string;
  title: string;
  description: string | null;
  passingPercentage: number;
  timeLimitSeconds: number | null;
  maxAttempts: number | null;
  requireAllQuestions: boolean;
  randomizeQuestions: boolean;
  questions: QuizPlayQuestion[];
  attempts: QuizAttemptSummary[];
  inProgressAttempt: QuizAttemptSummary | null;
  attemptsRemaining: number | null;
  canStart: boolean;
};

export type GradedAnswerResult = {
  questionId: string;
  questionText: string;
  questionType: string;
  isCorrect: boolean | null;
  needsReview: boolean;
  pointsAwarded: number;
  pointsPossible: number;
  explanation: string | null;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  text: string | null;
};

export type QuizSubmitResult = {
  attemptId: string;
  percentage: number;
  passed: boolean;
  pointsEarned: number;
  pointsPossible: number;
  answers: GradedAnswerResult[];
};

type Db = Awaited<ReturnType<typeof createClient>>;

async function assertQuizPlayable(
  courseId: string,
  quizId: string,
  userId: string
): Promise<{ ok: true; stepId: string | null } | { ok: false; error: string }> {
  if (!(await canAccessCourse(courseId))) {
    return { ok: false, error: "You do not have access to this course." };
  }

  const player = await getCoursePlayerData(courseId, userId);
  if (!player) return { ok: false, error: "Course not found." };

  const step = findStepByContent(player.flatSteps, "quiz", quizId);
  if (!step) return { ok: false, error: "This quiz is not in the course." };

  const bypass = await canManageCourse(courseId);
  const locked = lockedStepKeys(
    player.flatSteps,
    new Set(player.completedKeys),
    player.progressionType === "linear",
    bypass
  );
  if (locked.has(step.key)) {
    return { ok: false, error: "Complete previous steps first." };
  }

  return { ok: true, stepId: step.stepId };
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function getQuizForPlay(
  courseId: string,
  quizId: string
): Promise<ActionResult<QuizForPlay>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const gate = await assertQuizPlayable(courseId, quizId, user.id);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createClient();
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select(
      "id, title, description, passing_percentage, time_limit_seconds, max_attempts, require_all_questions, randomize_questions, status"
    )
    .eq("id", quizId)
    .maybeSingle<{
      id: string;
      title: string;
      description: string | null;
      passing_percentage: number;
      time_limit_seconds: number | null;
      max_attempts: number | null;
      require_all_questions: boolean;
      randomize_questions: boolean;
      status: string;
    }>();

  if (quizError || !quiz) {
    return { success: false, error: quizError?.message || "Quiz not found." };
  }
  if (quiz.status === "archived") {
    return { success: false, error: "This quiz is archived." };
  }

  const { data: links } = await supabase
    .from("quiz_questions")
    .select("question_id, sort_order, points_override")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ question_id: string; sort_order: number; points_override: number | null }>>();

  const questionIds = (links || []).map((l) => l.question_id);
  const questionsById = new Map<
    string,
    {
      id: string;
      title: string | null;
      question_text: string;
      question_type: string;
      default_points: number;
    }
  >();

  if (questionIds.length > 0) {
    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("id, title, question_text, question_type, default_points")
      .in("id", questionIds)
      .returns<
        Array<{
          id: string;
          title: string | null;
          question_text: string;
          question_type: string;
          default_points: number;
        }>
      >();
    if (qErr) return { success: false, error: qErr.message };
    for (const q of questions || []) questionsById.set(q.id, q);
  }

  const optionsByQuestion = new Map<string, QuizPlayOption[]>();
  if (questionIds.length > 0) {
    const { data: options, error: oErr } = await supabase
      .from("question_options")
      .select("id, question_id, answer_text, sort_order")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true })
      .returns<
        Array<{
          id: string;
          question_id: string;
          answer_text: string;
          sort_order: number;
        }>
      >();
    if (oErr) return { success: false, error: oErr.message };
    for (const opt of options || []) {
      const list = optionsByQuestion.get(opt.question_id) || [];
      // Never expose is_correct to the client before grading.
      list.push({
        id: opt.id,
        answerText: opt.answer_text,
        sortOrder: opt.sort_order,
      });
      optionsByQuestion.set(opt.question_id, list);
    }
  }

  let questions: QuizPlayQuestion[] = (links || [])
    .map((link) => {
      const q = questionsById.get(link.question_id);
      if (!q) return null;
      return {
        id: q.id,
        title: q.title,
        questionText: q.question_text,
        questionType: q.question_type,
        points: link.points_override ?? q.default_points,
        sortOrder: link.sort_order,
        options: optionsByQuestion.get(q.id) || [],
      };
    })
    .filter((q): q is QuizPlayQuestion => q != null);

  if (quiz.randomize_questions) {
    questions = shuffleWithSeed(questions, `${quizId}:${user.id}`);
  }

  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select(
      "id, attempt_number, started_at, submitted_at, percentage, passed, points_earned, points_possible"
    )
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .order("attempt_number", { ascending: false })
    .returns<
      Array<{
        id: string;
        attempt_number: number;
        started_at: string;
        submitted_at: string | null;
        percentage: number | null;
        passed: boolean | null;
        points_earned: number | null;
        points_possible: number | null;
      }>
    >();

  const mappedAttempts: QuizAttemptSummary[] = (attempts || []).map((a) => ({
    id: a.id,
    attemptNumber: a.attempt_number,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
    percentage: a.percentage,
    passed: a.passed,
    pointsEarned: a.points_earned,
    pointsPossible: a.points_possible,
  }));

  const inProgress = mappedAttempts.find((a) => !a.submittedAt) || null;
  const submittedCount = mappedAttempts.filter((a) => a.submittedAt).length;
  const attemptsRemaining =
    quiz.max_attempts == null ? null : Math.max(0, quiz.max_attempts - submittedCount);
  const canStart =
    !inProgress && (attemptsRemaining == null || attemptsRemaining > 0) && questions.length > 0;

  return {
    success: true,
    data: {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      passingPercentage: Number(quiz.passing_percentage),
      timeLimitSeconds: quiz.time_limit_seconds,
      maxAttempts: quiz.max_attempts,
      requireAllQuestions: quiz.require_all_questions,
      randomizeQuestions: quiz.randomize_questions,
      questions,
      attempts: mappedAttempts,
      inProgressAttempt: inProgress,
      attemptsRemaining,
      canStart,
    },
  };
}

export async function startQuizAttemptAction(
  input: unknown
): Promise<ActionResult<{ attemptId: string; attemptNumber: number; startedAt: string }>> {
  const parsed = startQuizAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid request." };
  }

  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const { courseId, quizId } = parsed.data;
  const gate = await assertQuizPlayable(courseId, quizId, user.id);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createClient();

  const { data: existingOpen } = await supabase
    .from("quiz_attempts")
    .select("id, attempt_number, started_at")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .is("submitted_at", null)
    .maybeSingle<{ id: string; attempt_number: number; started_at: string }>();

  if (existingOpen) {
    return {
      success: true,
      data: {
        attemptId: existingOpen.id,
        attemptNumber: existingOpen.attempt_number,
        startedAt: existingOpen.started_at,
      },
    };
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("max_attempts")
    .eq("id", quizId)
    .maybeSingle<{ max_attempts: number | null }>();

  const { count } = await supabase
    .from("quiz_attempts")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .not("submitted_at", "is", null);

  const submittedCount = count ?? 0;
  if (quiz?.max_attempts != null && submittedCount >= quiz.max_attempts) {
    return { success: false, error: "No attempts remaining." };
  }

  const attemptNumber = submittedCount + 1;
  const { data: created, error } = await supabase
    .from("quiz_attempts")
    .insert({
      quiz_id: quizId,
      student_id: user.id,
      course_id: courseId,
      attempt_number: attemptNumber,
    } as never)
    .select("id, attempt_number, started_at")
    .single<{ id: string; attempt_number: number; started_at: string }>();

  if (error || !created) {
    return { success: false, error: error?.message || "Failed to start attempt." };
  }

  revalidatePath(`/courses/${courseId}/quizzes/${quizId}`);
  return {
    success: true,
    data: {
      attemptId: created.id,
      attemptNumber: created.attempt_number,
      startedAt: created.started_at,
    },
  };
}

type GradeContext = {
  questionType: string;
  points: number;
  explanation: string | null;
  questionText: string;
  correctOptionIds: string[];
};

function gradeAnswer(
  ctx: GradeContext,
  answer: SubmitQuizAttemptInput["answers"][number]
): {
  answerData: Record<string, unknown>;
  isCorrect: boolean | null;
  needsReview: boolean;
  pointsAwarded: number;
  selectedOptionIds: string[];
  text: string | null;
} {
  const type = ctx.questionType;

  if (type === "essay" || type === "fill_blank" || type === "assessment") {
    const text = answer.text?.trim() || "";
    return {
      answerData: { text },
      isCorrect: null,
      needsReview: true,
      pointsAwarded: 0,
      selectedOptionIds: [],
      text,
    };
  }

  if (type === "multiple_choice") {
    const selected = Array.from(new Set(answer.selectedOptionIds || [])).sort();
    const correct = [...ctx.correctOptionIds].sort();
    const isCorrect =
      selected.length === correct.length && selected.every((id, i) => id === correct[i]);
    return {
      answerData: { selected_option_ids: selected },
      isCorrect,
      needsReview: false,
      pointsAwarded: isCorrect ? ctx.points : 0,
      selectedOptionIds: selected,
      text: null,
    };
  }

  // single_choice / true_false (and unknown choice types)
  const selectedId = answer.selectedOptionId;
  const selected = selectedId ? [selectedId] : [];
  const isCorrect = Boolean(
    selectedId && ctx.correctOptionIds.length === 1 && ctx.correctOptionIds[0] === selectedId
  );
  return {
    answerData: selectedId
      ? { selected_option_id: selectedId }
      : type === "true_false"
        ? { value: null }
        : {},
    isCorrect: selectedId ? isCorrect : false,
    needsReview: false,
    pointsAwarded: selectedId && isCorrect ? ctx.points : 0,
    selectedOptionIds: selected,
    text: null,
  };
}

export async function submitQuizAttemptAction(
  input: unknown
): Promise<ActionResult<QuizSubmitResult>> {
  const parsed = submitQuizAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid submission." };
  }

  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const { courseId, quizId, attemptId, answers, stepId } = parsed.data;
  const gate = await assertQuizPlayable(courseId, quizId, user.id);
  if (!gate.ok) return { success: false, error: gate.error };

  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, student_id, quiz_id, course_id, started_at, submitted_at")
    .eq("id", attemptId)
    .maybeSingle<{
      id: string;
      student_id: string;
      quiz_id: string;
      course_id: string;
      started_at: string;
      submitted_at: string | null;
    }>();

  if (!attempt || attempt.student_id !== user.id || attempt.quiz_id !== quizId) {
    return { success: false, error: "Attempt not found." };
  }
  if (attempt.course_id !== courseId) {
    return { success: false, error: "Attempt does not match this course." };
  }
  if (attempt.submitted_at) {
    return { success: false, error: "This attempt was already submitted." };
  }

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("passing_percentage, require_all_questions, time_limit_seconds")
    .eq("id", quizId)
    .maybeSingle<{
      passing_percentage: number;
      require_all_questions: boolean;
      time_limit_seconds: number | null;
    }>();

  if (!quiz) return { success: false, error: "Quiz not found." };

  const { data: links } = await supabase
    .from("quiz_questions")
    .select("question_id, sort_order, points_override")
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ question_id: string; sort_order: number; points_override: number | null }>>();

  const questionIds = (links || []).map((l) => l.question_id);
  if (questionIds.length === 0) {
    return { success: false, error: "This quiz has no questions." };
  }

  if (quiz.require_all_questions) {
    const answered = new Set(answers.map((a) => a.questionId));
    const missing = questionIds.some((id) => !answered.has(id));
    if (missing) {
      return { success: false, error: "Please answer all questions before submitting." };
    }
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, question_type, default_points, explanation")
    .in("id", questionIds)
    .returns<
      Array<{
        id: string;
        question_text: string;
        question_type: string;
        default_points: number;
        explanation: string | null;
      }>
    >();

  const { data: options } = await supabase
    .from("question_options")
    .select("id, question_id, is_correct")
    .in("question_id", questionIds)
    .returns<Array<{ id: string; question_id: string; is_correct: boolean }>>();

  const qById = new Map((questions || []).map((q) => [q.id, q]));
  const correctByQuestion = new Map<string, string[]>();
  for (const opt of options || []) {
    if (!opt.is_correct) continue;
    const list = correctByQuestion.get(opt.question_id) || [];
    list.push(opt.id);
    correctByQuestion.set(opt.question_id, list);
  }
  const pointsByQuestion = new Map(
    (links || []).map((l) => {
      const q = qById.get(l.question_id);
      return [l.question_id, l.points_override ?? q?.default_points ?? 0] as const;
    })
  );

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const graded: GradedAnswerResult[] = [];
  let pointsEarned = 0;
  let pointsPossible = 0;

  for (const qid of questionIds) {
    const q = qById.get(qid);
    if (!q) continue;
    const points = pointsByQuestion.get(qid) ?? q.default_points;
    pointsPossible += points;
    const raw = answerByQuestion.get(qid) || { questionId: qid };
    const result = gradeAnswer(
      {
        questionType: q.question_type,
        points,
        explanation: q.explanation,
        questionText: q.question_text,
        correctOptionIds: correctByQuestion.get(qid) || [],
      },
      raw
    );
    pointsEarned += result.pointsAwarded;
    graded.push({
      questionId: qid,
      questionText: q.question_text,
      questionType: q.question_type,
      isCorrect: result.isCorrect,
      needsReview: result.needsReview,
      pointsAwarded: result.pointsAwarded,
      pointsPossible: points,
      explanation: q.explanation,
      selectedOptionIds: result.selectedOptionIds,
      correctOptionIds: correctByQuestion.get(qid) || [],
      text: result.text,
    });

    const { error: ansErr } = await supabase.from("quiz_attempt_answers").upsert(
      {
        attempt_id: attemptId,
        question_id: qid,
        answer_data: result.answerData,
        is_correct: result.isCorrect,
        points_awarded: result.pointsAwarded,
        needs_review: result.needsReview,
      } as never,
      { onConflict: "attempt_id,question_id" }
    );
    if (ansErr) return { success: false, error: ansErr.message };
  }

  const percentage =
    pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 10000) / 100 : 0;
  const passed = percentage >= Number(quiz.passing_percentage);
  const timeSpentSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000)
  );

  const { error: updErr } = await supabase
    .from("quiz_attempts")
    .update({
      submitted_at: new Date().toISOString(),
      score: pointsEarned,
      percentage,
      points_earned: pointsEarned,
      points_possible: pointsPossible,
      passed,
      time_spent_seconds: timeSpentSeconds,
    } as never)
    .eq("id", attemptId);

  if (updErr) return { success: false, error: updErr.message };

  if (passed) {
    const resolvedStepId = stepId ?? gate.stepId;
    if (resolvedStepId) {
      await supabase.from("step_progress").upsert(
        {
          student_id: user.id,
          course_id: courseId,
          course_step_id: resolvedStepId,
          completed: true,
          completed_at: new Date().toISOString(),
        } as never,
        { onConflict: "student_id,course_step_id" }
      );
    }
  }

  revalidatePath(`/courses/${courseId}`, "layout");
  revalidatePath(`/courses/${courseId}/quizzes/${quizId}`);

  return {
    success: true,
    data: {
      attemptId,
      percentage,
      passed,
      pointsEarned,
      pointsPossible,
      answers: graded,
    },
  };
}

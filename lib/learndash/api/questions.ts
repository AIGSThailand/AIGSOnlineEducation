import { fetchAllPages, learndashFetch, mapWithConcurrency } from "../client";
import { getLearnDashConfig } from "../config";
import { LearnDashError } from "../errors";
import type { LearnDashEntityId } from "../types/common";
import type { LearnDashProQuizQuestion, LearnDashQuestion } from "../types/question";

/** List all sfwd-question posts for a quiz (v2). Answers field is usually null. */
export async function listLearnDashQuestionsForQuiz(
  quizId: LearnDashEntityId
): Promise<LearnDashQuestion[]> {
  // Do NOT pass context=edit on the collection — it breaks the `quiz` filter on this site
  // and returns the entire question bank (~2k rows).
  const rows = await fetchAllPages<LearnDashQuestion>({
    path: "/wp-json/ldlms/v2/sfwd-question",
    query: {
      quiz: quizId,
      orderby: "menu_order",
      order: "asc",
    },
  });

  // Defensive: keep only rows that actually belong to this quiz.
  return rows.filter((q) => Number(q.quiz) === Number(quizId));
}

/**
 * ProQuiz question detail including `_answerData`.
 * v2 `answers` is null on edu.aigsthailand.com; v1 single-item route works.
 */
export async function getLearnDashProQuizQuestion(
  questionId: LearnDashEntityId
): Promise<LearnDashProQuizQuestion> {
  const { data } = await learndashFetch<LearnDashProQuizQuestion>({
    path: `/wp-json/ldlms/v1/sfwd-questions/${questionId}`,
  });
  return data;
}

export async function getLearnDashProQuizQuestionSafe(
  questionId: LearnDashEntityId
): Promise<LearnDashProQuizQuestion | null> {
  try {
    return await getLearnDashProQuizQuestion(questionId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") return null;
    throw err;
  }
}

export type LearnDashQuestionBundle = {
  question: LearnDashQuestion;
  proQuiz: LearnDashProQuizQuestion | null;
};

/** List quiz questions (v2) and enrich each with ProQuiz answers (v1). */
export async function fetchLearnDashQuestionsForQuiz(
  quizId: LearnDashEntityId
): Promise<LearnDashQuestionBundle[]> {
  const questions = await listLearnDashQuestionsForQuiz(quizId);
  const config = getLearnDashConfig();

  return mapWithConcurrency(questions, config.concurrency, async (question) => {
    const proQuiz = await getLearnDashProQuizQuestionSafe(question.id);
    return { question, proQuiz };
  });
}

import { getRenderedText } from "@/lib/learndash/types/common";
import { wordpressContentToHtml, wordpressContentToPlainText } from "@/lib/utils/wordpress-content";
import { decodeHtmlEntities } from "./html";
import type { LearnDashQuestionBundle } from "@/lib/learndash/api/questions";
import type { LearnDashProQuizAnswer } from "@/lib/learndash/types/question";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";

export type AigsQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "essay"
  | "assessment";

export type ProposedQuestionOption = {
  answerText: string;
  isCorrect: boolean;
  sortOrder: number;
  feedback: string | null;
};

export type ProposedQuestion = {
  wordpressQuestionId: LearnDashEntityId;
  wordpressQuizId: LearnDashEntityId;
  title: string | null;
  questionText: string;
  questionType: AigsQuestionType;
  defaultPoints: number;
  explanation: string | null;
  sortOrder: number;
  options: ProposedQuestionOption[];
  warnings: string[];
};

export type ProposedQuizQuestions = {
  wordpressQuizId: LearnDashEntityId;
  questions: ProposedQuestion[];
  summary: {
    questions: number;
    withOptions: number;
    missingOptions: number;
    byType: Record<string, number>;
  };
};

export function mapLearnDashQuestionType(source: string | undefined): AigsQuestionType {
  const key = (source || "").toLowerCase().trim();
  const map: Record<string, AigsQuestionType> = {
    single: "single_choice",
    multiple: "multiple_choice",
    essay: "essay",
    free_answer: "essay",
    assessment: "assessment",
    cloze_answer: "fill_blank",
    true_false: "true_false",
    sort_answer: "single_choice",
    matrix_sort_answer: "single_choice",
  };
  return map[key] || "single_choice";
}

function isCorrectFlag(value: LearnDashProQuizAnswer["_correct"]): boolean {
  return value === true || value === "1" || value === 1;
}

function stripToText(html: string | null | undefined): string {
  return wordpressContentToPlainText(html || "");
}

export function transformProQuizAnswers(
  answers: LearnDashProQuizAnswer[] | null | undefined
): ProposedQuestionOption[] {
  if (!Array.isArray(answers)) return [];
  const options: ProposedQuestionOption[] = [];
  let idx = 0;
  for (const answer of answers) {
    const raw = (answer._answer || "").trim();
    if (!raw) continue;
    const answerText = stripToText(raw) || decodeHtmlEntities(raw);
    if (!answerText) continue;
    options.push({
      answerText,
      isCorrect: isCorrectFlag(answer._correct),
      sortOrder: idx,
      feedback: null,
    });
    idx += 1;
  }
  return options;
}

export function transformLearnDashQuestionBundle(
  bundle: LearnDashQuestionBundle,
  fallbackQuizId: LearnDashEntityId
): ProposedQuestion {
  const { question, proQuiz } = bundle;
  const warnings: string[] = [];

  const wordpressQuizId = Number(question.quiz || proQuiz?._quizId || fallbackQuizId);
  const titleRaw = getRenderedText(question.title) || proQuiz?._title || proQuiz?.question_post_title;
  const title = titleRaw ? decodeHtmlEntities(titleRaw) : null;

  const questionHtml =
    proQuiz?._question ||
    getRenderedText(question.content) ||
    title ||
    `Question #${question.id}`;
  const questionText =
    stripToText(questionHtml) || decodeHtmlEntities(String(questionHtml)) || `Question #${question.id}`;

  const questionType = mapLearnDashQuestionType(proQuiz?._answerType || question.question_type);
  const points = Number(proQuiz?._points ?? question.points_total ?? 1);
  const explanation = proQuiz?._tipMsg ? stripToText(proQuiz._tipMsg) || null : null;

  const options = transformProQuizAnswers(proQuiz?._answerData ?? null);
  if (!proQuiz) {
    warnings.push(`ProQuiz detail missing for question ${question.id} (v1 fetch failed).`);
  } else if (
    (questionType === "single_choice" ||
      questionType === "multiple_choice" ||
      questionType === "true_false") &&
    options.length === 0
  ) {
    warnings.push(`No answer options in ProQuiz _answerData for question ${question.id}.`);
  }

  return {
    wordpressQuestionId: question.id,
    wordpressQuizId: Number.isFinite(wordpressQuizId) ? wordpressQuizId : fallbackQuizId,
    title,
    questionText,
    questionType,
    defaultPoints: Number.isFinite(points) && points >= 0 ? points : 1,
    explanation,
    sortOrder: Number(question.menu_order ?? proQuiz?._sort ?? 0),
    options,
    warnings,
  };
}

export function transformLearnDashQuizQuestions(
  wordpressQuizId: LearnDashEntityId,
  bundles: LearnDashQuestionBundle[]
): ProposedQuizQuestions {
  const questions = bundles
    .map((b) => transformLearnDashQuestionBundle(b, wordpressQuizId))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.wordpressQuestionId - b.wordpressQuestionId
    )
    .map((q, index) => ({ ...q, sortOrder: index }));

  const byType: Record<string, number> = {};
  let withOptions = 0;
  for (const q of questions) {
    byType[q.questionType] = (byType[q.questionType] || 0) + 1;
    if (q.options.length > 0) withOptions += 1;
  }

  return {
    wordpressQuizId,
    questions,
    summary: {
      questions: questions.length,
      withOptions,
      missingOptions: questions.length - withOptions,
      byType,
    },
  };
}

export function formatQuizQuestionsReport(proposed: ProposedQuizQuestions): string {
  const lines = [
    `QUIZ QUESTIONS (wordpress quiz ${proposed.wordpressQuizId})`,
    `  Questions: ${proposed.summary.questions}`,
    `  With options: ${proposed.summary.withOptions}`,
    `  Missing options: ${proposed.summary.missingOptions}`,
    `  Types: ${JSON.stringify(proposed.summary.byType)}`,
    "",
  ];
  for (const q of proposed.questions.slice(0, 12)) {
    lines.push(
      `  Q${q.sortOrder + 1} [${q.questionType}] ${q.questionText.slice(0, 80)}${q.questionText.length > 80 ? "…" : ""} (${q.options.length} opts)`
    );
  }
  if (proposed.questions.length > 12) {
    lines.push(`  … ${proposed.questions.length - 12} more`);
  }
  return lines.join("\n");
}

/** Re-export for writers that store HTML explanations. */
export function questionExplanationHtml(text: string | null): string | null {
  if (!text) return null;
  return wordpressContentToHtml(text) || text;
}

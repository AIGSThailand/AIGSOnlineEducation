import type { LearnDashEntityId, LearnDashRenderedField, LearnDashWpEntity } from "./common";

/** LearnDash v2 `sfwd-question` post (list/detail). `answers` is often null on this site. */
export type LearnDashQuestion = LearnDashWpEntity & {
  type?: "sfwd-question" | string;
  quiz?: LearnDashEntityId | null;
  question_type?: string;
  points_total?: number;
  points_per_answer?: boolean;
  points_show_in_message?: boolean;
  points_diff_modus?: boolean;
  disable_correct?: boolean;
  correct_message?: LearnDashRenderedField | string;
  incorrect_message?: LearnDashRenderedField | string;
  correct_same?: boolean;
  hints_enabled?: boolean;
  hints_message?: LearnDashRenderedField | string;
  menu_order?: number;
  answers?: unknown;
};

/** ProQuiz answer row from v1 `sfwd-questions/{id}` `_answerData`. */
export type LearnDashProQuizAnswer = {
  _answer?: string;
  _html?: boolean | string | number;
  _points?: number;
  _correct?: boolean | string | number;
  _sortString?: string;
  _sortStringHtml?: boolean | string | number;
  _graded?: boolean | string | number;
  _gradingProgression?: string;
  _gradedType?: string | null;
};

/**
 * LearnDash v1 ProQuiz question payload.
 * Endpoint: GET /wp-json/ldlms/v1/sfwd-questions/{wordpressQuestionId}
 */
export type LearnDashProQuizQuestion = {
  _id?: number;
  _questionPostId?: number;
  _quizId?: number;
  _sort?: number;
  _title?: string;
  _question?: string;
  _correctMsg?: string;
  _incorrectMsg?: string;
  _correctSameText?: boolean;
  _tipEnabled?: boolean;
  _tipMsg?: string;
  _points?: number;
  _answerType?: string;
  _answerData?: LearnDashProQuizAnswer[] | null;
  question_id?: number;
  question_post_title?: string;
  [key: string]: unknown;
};

/** Enriched quiz settings from v2 `context=edit`. */
export type LearnDashQuizSettings = {
  passing_percentage?: number;
  retry_restrictions_enabled?: boolean | string | number;
  retry_repeats?: string | number;
  answer_all_questions_enabled?: boolean | string | number;
  time_limit_enabled?: boolean | string | number;
  time_limit_time?: number;
  question_random?: boolean | string | number;
  quiz_modus?: string | number;
};

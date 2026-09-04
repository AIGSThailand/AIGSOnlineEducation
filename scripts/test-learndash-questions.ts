/**
 * Offline checks for Phase 3 question / answer transforms.
 * Run: npm run test:learndash-questions
 */
import {
  mapLearnDashQuestionType,
  transformLearnDashQuestionBundle,
  transformProQuizAnswers,
} from "../features/migration/learndash/transform-questions";
import type { LearnDashQuestionBundle } from "../lib/learndash/api/questions";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(mapLearnDashQuestionType("single") === "single_choice", "single");
assert(mapLearnDashQuestionType("multiple") === "multiple_choice", "multiple");
assert(mapLearnDashQuestionType("true_false") === "true_false", "tf");
assert(mapLearnDashQuestionType("cloze_answer") === "fill_blank", "cloze");
assert(mapLearnDashQuestionType("essay") === "essay", "essay");

const options = transformProQuizAnswers([
  { _answer: "Red", _correct: false },
  { _answer: "Colorless", _correct: true },
  { _answer: "  ", _correct: false },
  { _answer: "Blue", _correct: "1" },
]);
assert(options.length === 3, `opts len ${options.length}`);
assert(options[1].isCorrect === true, "correct middle");
assert(options[2].isCorrect === true, "correct string 1");
assert(options[0].sortOrder === 0 && options[2].sortOrder === 2, "sort");

const bundle: LearnDashQuestionBundle = {
  question: {
    id: 26561,
    quiz: 26556,
    question_type: "single",
    points_total: 1,
    menu_order: 1,
    title: { rendered: "Chemically pure corundum is" },
    content: { rendered: "<p>Chemically pure corundum is</p>" },
  },
  proQuiz: {
    _answerType: "single",
    _points: 1,
    _question: "Chemically pure corundum is",
    _tipMsg: "Tip here",
    _answerData: [
      { _answer: "Red", _correct: false },
      { _answer: "Colorless", _correct: true },
    ],
  },
};

const proposed = transformLearnDashQuestionBundle(bundle, 26556);
assert(proposed.questionType === "single_choice", "type");
assert(proposed.options.length === 2, "options");
assert(proposed.options.some((o) => o.isCorrect), "has correct");
assert(proposed.explanation === "Tip here", "tip");
assert(proposed.wordpressQuizId === 26556, "quiz id");

console.log("test:learndash-questions OK");

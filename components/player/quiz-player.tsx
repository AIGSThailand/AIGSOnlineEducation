"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  startQuizAttemptAction,
  submitQuizAttemptAction,
  type GradedAnswerResult,
  type QuizForPlay,
  type QuizSubmitResult,
} from "@/features/quizzes/player-actions";

type AnswerState = {
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  text?: string;
};

interface QuizPlayerProps {
  courseId: string;
  quizId: string;
  stepId: string | null;
  initial: QuizForPlay;
}

export function QuizPlayer({ courseId, quizId, stepId, initial }: QuizPlayerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quiz, setQuiz] = useState(initial);
  const [phase, setPhase] = useState<"intro" | "taking" | "results">(
    initial.inProgressAttempt ? "taking" : "intro"
  );
  const [attemptId, setAttemptId] = useState<string | null>(
    initial.inProgressAttempt?.id ?? null
  );
  const [startedAt, setStartedAt] = useState<string | null>(
    initial.inProgressAttempt?.startedAt ?? null
  );
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    setQuiz(initial);
    if (initial.inProgressAttempt && phase === "intro") {
      setPhase("taking");
      setAttemptId(initial.inProgressAttempt.id);
      setStartedAt(initial.inProgressAttempt.startedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    if (phase !== "taking" || !startedAt || !quiz.timeLimitSeconds) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setSecondsLeft(Math.max(0, quiz.timeLimitSeconds! - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, startedAt, quiz.timeLimitSeconds]);

  const answeredCount = useMemo(() => {
    return quiz.questions.filter((q) => {
      const a = answers[q.id];
      if (!a) return false;
      if (q.questionType === "multiple_choice") return (a.selectedOptionIds?.length ?? 0) > 0;
      if (q.questionType === "essay" || q.questionType === "fill_blank" || q.questionType === "assessment") {
        return Boolean(a.text?.trim());
      }
      return Boolean(a.selectedOptionId);
    }).length;
  }, [answers, quiz.questions]);

  function startAttempt() {
    setError(null);
    startTransition(async () => {
      const res = await startQuizAttemptAction({ courseId, quizId, stepId: stepId ?? undefined });
      if (!res.success || !res.data) {
        setError(res.success ? "Could not start attempt." : res.error);
        return;
      }
      setAttemptId(res.data.attemptId);
      setStartedAt(res.data.startedAt);
      setAnswers({});
      setResult(null);
      setPhase("taking");
      router.refresh();
    });
  }

  function submit() {
    if (!attemptId) return;
    setError(null);

    if (quiz.requireAllQuestions && answeredCount < quiz.questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }

    const payload = quiz.questions.map((q) => {
      const a = answers[q.id] || {};
      return {
        questionId: q.id,
        selectedOptionId: a.selectedOptionId,
        selectedOptionIds: a.selectedOptionIds,
        text: a.text,
      };
    });

    startTransition(async () => {
      const res = await submitQuizAttemptAction({
        courseId,
        quizId,
        attemptId,
        stepId: stepId ?? undefined,
        answers: payload,
      });
      if (!res.success || !res.data) {
        setError(res.success ? "Submit failed." : res.error);
        return;
      }
      setResult(res.data);
      setPhase("results");
      router.refresh();
    });
  }

  if (quiz.questions.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This quiz has no questions yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {phase === "intro" && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
          {quiz.description ? <p className="text-sm text-slate-700">{quiz.description}</p> : null}
          <ul className="space-y-1 text-sm text-slate-600">
            <li>
              {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
            </li>
            <li>Passing score: {quiz.passingPercentage}%</li>
            {quiz.timeLimitSeconds != null && (
              <li>Time limit: {Math.ceil(quiz.timeLimitSeconds / 60)} min</li>
            )}
            {quiz.maxAttempts != null && (
              <li>
                Attempts remaining: {quiz.attemptsRemaining ?? 0} of {quiz.maxAttempts}
              </li>
            )}
            {quiz.requireAllQuestions && <li>All questions are required</li>}
          </ul>

          {quiz.attempts.filter((a) => a.submittedAt).length > 0 && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Previous attempts
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {quiz.attempts
                  .filter((a) => a.submittedAt)
                  .map((a) => (
                    <li key={a.id}>
                      Attempt {a.attemptNumber}: {a.percentage ?? 0}%
                      {a.passed == null ? "" : a.passed ? " · Passed" : " · Not passed"}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <Button disabled={pending || !quiz.canStart} onClick={startAttempt}>
            {pending ? "Starting…" : quiz.canStart ? "Start quiz" : "No attempts remaining"}
          </Button>
        </div>
      )}

      {phase === "taking" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <p>
              Answered {answeredCount}/{quiz.questions.length}
            </p>
            {secondsLeft != null && (
              <p
                className={
                  secondsLeft <= 60 ? "font-semibold text-red-600" : "font-medium text-slate-800"
                }
                aria-live="polite"
              >
                Time left: {formatClock(secondsLeft)}
              </p>
            )}
          </div>

          {quiz.questions.map((q, index) => (
            <fieldset
              key={q.id}
              className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
            >
              <legend className="px-1 text-sm font-semibold text-slate-900">
                {index + 1}. {q.questionText}
                <span className="ml-2 font-normal text-slate-500">({q.points} pt)</span>
              </legend>

              {(q.questionType === "single_choice" || q.questionType === "true_false") && (
                <div className="space-y-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name={`q-${q.id}`}
                        checked={answers[q.id]?.selectedOptionId === opt.id}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q.id]: { selectedOptionId: opt.id },
                          }))
                        }
                      />
                      <span>{opt.answerText}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.questionType === "multiple_choice" && (
                <div className="space-y-2" role="group" aria-label={`Question ${index + 1}`}>
                  {q.options.map((opt) => {
                    const checked = answers[q.id]?.selectedOptionIds?.includes(opt.id) ?? false;
                    return (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() =>
                            setAnswers((prev) => {
                              const current = prev[q.id]?.selectedOptionIds || [];
                              const next = checked
                                ? current.filter((id) => id !== opt.id)
                                : [...current, opt.id];
                              return { ...prev, [q.id]: { selectedOptionIds: next } };
                            })
                          }
                        />
                        <span>{opt.answerText}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {(q.questionType === "essay" ||
                q.questionType === "fill_blank" ||
                q.questionType === "assessment") && (
                <textarea
                  className="min-h-[100px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={answers[q.id]?.text || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: { text: e.target.value },
                    }))
                  }
                  placeholder={
                    q.questionType === "essay" ? "Write your answer…" : "Your response…"
                  }
                  aria-label={`Answer for question ${index + 1}`}
                />
              )}

              {!["single_choice", "multiple_choice", "true_false", "essay", "fill_blank", "assessment"].includes(
                q.questionType
              ) && (
                <p className="text-xs text-amber-700">
                  Unsupported question type ({q.questionType}). Skip or contact your instructor.
                </p>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={submit}>
              {pending ? "Submitting…" : "Submit quiz"}
            </Button>
          </div>
        </div>
      )}

      {phase === "results" && result && (
        <div className="space-y-5">
          <div
            className={`rounded-lg border px-4 py-4 ${
              result.passed
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="text-lg font-semibold">
              {result.passed ? "Passed" : "Not passed"} — {result.percentage}%
            </p>
            <p className="mt-1 text-sm">
              {result.pointsEarned} / {result.pointsPossible} points
              {result.passed
                ? " · This step is marked complete."
                : ` · Need ${quiz.passingPercentage}% to pass.`}
            </p>
          </div>

          <ul className="space-y-3">
            {result.answers.map((a, i) => (
              <ResultRow key={a.questionId} index={i} answer={a} />
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            {(quiz.attemptsRemaining == null || (quiz.attemptsRemaining ?? 0) > 0) &&
              !result.passed && (
                <Button
                  disabled={pending}
                  onClick={() => {
                    setPhase("intro");
                    setAttemptId(null);
                    setStartedAt(null);
                    setAnswers({});
                    setResult(null);
                    setQuiz((prev) => ({
                      ...prev,
                      inProgressAttempt: null,
                      canStart:
                        prev.attemptsRemaining == null || (prev.attemptsRemaining ?? 0) > 0,
                      attemptsRemaining:
                        prev.attemptsRemaining == null
                          ? null
                          : Math.max(0, (prev.attemptsRemaining ?? 1) - 1),
                    }));
                  }}
                >
                  Try again
                </Button>
              )}
            <Button
              variant="secondary"
              onClick={() => {
                setPhase("intro");
                router.refresh();
              }}
            >
              Back to overview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ index, answer }: { index: number; answer: GradedAnswerResult }) {
  const status =
    answer.needsReview
      ? "Needs review"
      : answer.isCorrect
        ? "Correct"
        : "Incorrect";

  return (
    <li className="rounded-lg border border-slate-200 p-4 text-sm">
      <p className="font-medium text-slate-900">
        {index + 1}. {answer.questionText}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {status} · {answer.pointsAwarded}/{answer.pointsPossible} pt
      </p>
      {answer.explanation ? (
        <p className="mt-2 text-slate-600">Explanation: {answer.explanation}</p>
      ) : null}
    </li>
  );
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

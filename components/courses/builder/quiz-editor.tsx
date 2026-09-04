"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteQuizQuestionAction,
  getQuizForEdit,
  reorderQuizQuestionAction,
  updateQuizAction,
  upsertQuizQuestionAction,
  type QuizQuestionForEdit,
} from "@/features/quizzes/actions";
import type { SaveStatus } from "@/features/courses/types";

const AUTOSAVE_MS = 1200;

interface QuizEditorProps {
  courseId: string;
  quizId: string;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

type QuizForm = {
  title: string;
  slug: string;
  description: string;
  status: "draft" | "published" | "archived";
  passingPercentage: number;
  timeLimitSeconds: string;
  maxAttempts: string;
  requireAllQuestions: boolean;
  randomizeQuestions: boolean;
};

type OptionDraft = {
  key: string;
  answerText: string;
  isCorrect: boolean;
  feedback: string;
};

type QuestionDraft = {
  questionId?: string;
  title: string;
  questionText: string;
  questionType: "single_choice" | "multiple_choice" | "true_false" | "essay";
  defaultPoints: number;
  explanation: string;
  options: OptionDraft[];
};

function emptyQuestionDraft(
  type: QuestionDraft["questionType"] = "single_choice"
): QuestionDraft {
  const base: QuestionDraft = {
    title: "",
    questionText: "",
    questionType: type,
    defaultPoints: 1,
    explanation: "",
    options: [],
  };
  if (type === "true_false") {
    base.options = [
      { key: "tf-true", answerText: "True", isCorrect: true, feedback: "" },
      { key: "tf-false", answerText: "False", isCorrect: false, feedback: "" },
    ];
  } else if (type === "single_choice" || type === "multiple_choice") {
    base.options = [
      { key: crypto.randomUUID(), answerText: "", isCorrect: true, feedback: "" },
      { key: crypto.randomUUID(), answerText: "", isCorrect: false, feedback: "" },
    ];
  }
  return base;
}

function fromServerQuestion(q: QuizQuestionForEdit): QuestionDraft {
  const type = (
    ["single_choice", "multiple_choice", "true_false", "essay"].includes(q.questionType)
      ? q.questionType
      : "essay"
  ) as QuestionDraft["questionType"];

  return {
    questionId: q.id,
    title: q.title || "",
    questionText: q.questionText,
    questionType: type,
    defaultPoints: q.defaultPoints,
    explanation: q.explanation || "",
    options:
      q.options.length > 0
        ? q.options.map((o) => ({
            key: o.id,
            answerText: o.answerText,
            isCorrect: o.isCorrect,
            feedback: o.feedback || "",
          }))
        : type === "essay"
          ? []
          : emptyQuestionDraft(type).options,
  };
}

export function QuizEditor({
  courseId,
  quizId,
  onSaveStatusChange,
  saveSignal,
}: QuizEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<QuizForm>({
    title: "",
    slug: "",
    description: "",
    status: "draft",
    passingPercentage: 80,
    timeLimitSeconds: "",
    maxAttempts: "",
    requireAllQuestions: true,
    randomizeQuestions: false,
  });
  const [questions, setQuestions] = useState<QuizQuestionForEdit[]>([]);
  const [wordpressQuizId, setWordpressQuizId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<QuestionDraft | null>(null);
  const [questionBusy, setQuestionBusy] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const formRef = useRef(form);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  formRef.current = form;
  dirtyRef.current = dirty;

  const reload = useCallback(async () => {
    const result = await getQuizForEdit(courseId, quizId);
    if (result.success && result.data) {
      setForm({
        title: result.data.title,
        slug: result.data.slug,
        description: result.data.description || "",
        status: result.data.status as QuizForm["status"],
        passingPercentage: result.data.passingPercentage,
        timeLimitSeconds:
          result.data.timeLimitSeconds != null ? String(result.data.timeLimitSeconds) : "",
        maxAttempts: result.data.maxAttempts != null ? String(result.data.maxAttempts) : "",
        requireAllQuestions: result.data.requireAllQuestions,
        randomizeQuestions: result.data.randomizeQuestions,
      });
      setQuestions(result.data.questions);
      setWordpressQuizId(result.data.wordpressQuizId);
      setError(null);
      return true;
    }
    setError(result.success ? "Quiz not found." : result.error);
    return false;
  }, [courseId, quizId]);

  const persist = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const current = formRef.current;
      if (!current.title.trim() || !current.slug.trim()) {
        return { success: false as const, error: "Title and slug are required." };
      }

      setIsSaving(true);
      onSaveStatusChange("saving");
      setError(null);

      const timeLimit = current.timeLimitSeconds.trim()
        ? Number(current.timeLimitSeconds)
        : null;
      const maxAttempts = current.maxAttempts.trim() ? Number(current.maxAttempts) : null;

      const result = await updateQuizAction({
        courseId,
        quizId,
        title: current.title,
        slug: current.slug,
        description: current.description,
        status: current.status,
        passingPercentage: current.passingPercentage,
        timeLimitSeconds: Number.isFinite(timeLimit) && timeLimit && timeLimit > 0 ? timeLimit : null,
        maxAttempts:
          Number.isFinite(maxAttempts) && maxAttempts && maxAttempts > 0 ? maxAttempts : null,
        requireAllQuestions: current.requireAllQuestions,
        randomizeQuestions: current.randomizeQuestions,
      });

      setIsSaving(false);

      if (result.success) {
        setDirty(false);
        dirtyRef.current = false;
        onSaveStatusChange("saved");
        if (opts?.refresh) router.refresh();
      } else {
        setError(result.error);
        onSaveStatusChange("error");
      }
      return result;
    },
    [courseId, quizId, onSaveStatusChange, router]
  );

  const scheduleAutosave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!dirtyRef.current) return;
      startTransition(() => {
        void persist();
      });
    }, AUTOSAVE_MS);
  }, [persist]);

  const patchForm = useCallback(
    (patch: Partial<QuizForm>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      setDirty(true);
      dirtyRef.current = true;
      onSaveStatusChange("unsaved");
      scheduleAutosave();
    },
    [onSaveStatusChange, scheduleAutosave]
  );

  useEffect(() => {
    setLoading(true);
    setDirty(false);
    dirtyRef.current = false;
    setEditing(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);

    void reload().finally(() => {
      setLoading(false);
      onSaveStatusChange("idle");
    });

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [courseId, quizId, onSaveStatusChange, reload]);

  useEffect(() => {
    if (!saveSignal || saveSignal <= 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    startTransition(() => {
      void persist({ refresh: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  async function saveQuestion() {
    if (!editing) return;
    setQuestionBusy(true);
    setQuestionError(null);

    const result = await upsertQuizQuestionAction({
      courseId,
      quizId,
      questionId: editing.questionId,
      title: editing.title,
      questionText: editing.questionText,
      questionType: editing.questionType,
      defaultPoints: editing.defaultPoints,
      explanation: editing.explanation,
      options: editing.options.map((o, index) => ({
        answerText: o.answerText,
        isCorrect: o.isCorrect,
        sortOrder: index,
        feedback: o.feedback,
      })),
    });

    setQuestionBusy(false);
    if (!result.success) {
      setQuestionError(result.error);
      return;
    }
    setEditing(null);
    await reload();
    router.refresh();
  }

  async function removeQuestion(questionId: string) {
    if (!window.confirm("Remove this question from the quiz?")) return;
    setQuestionBusy(true);
    const result = await deleteQuizQuestionAction({ courseId, quizId, questionId });
    setQuestionBusy(false);
    if (!result.success) {
      setQuestionError(result.error);
      return;
    }
    if (editing?.questionId === questionId) setEditing(null);
    await reload();
    router.refresh();
  }

  async function moveQuestion(questionId: string, direction: "up" | "down") {
    setQuestionBusy(true);
    const result = await reorderQuizQuestionAction({ courseId, quizId, questionId, direction });
    setQuestionBusy(false);
    if (!result.success) {
      setQuestionError(result.error);
      return;
    }
    await reload();
  }

  if (loading) {
    return (
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Quiz editor</h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={isSaving || !dirty}
            onClick={() => void persist({ refresh: true })}
          >
            {isSaving ? "Saving…" : "Save quiz"}
          </Button>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="quiz-title">Title</Label>
            <Input
              id="quiz-title"
              value={form.title}
              onChange={(e) => patchForm({ title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quiz-slug">Slug</Label>
            <Input
              id="quiz-slug"
              value={form.slug}
              onChange={(e) => patchForm({ slug: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quiz-status">Status</Label>
            <Select
              id="quiz-status"
              value={form.status}
              onChange={(e) =>
                patchForm({ status: e.target.value as QuizForm["status"] })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="quiz-description">Description</Label>
            <Textarea
              id="quiz-description"
              rows={3}
              value={form.description}
              onChange={(e) => patchForm({ description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quiz-pass">Passing %</Label>
            <Input
              id="quiz-pass"
              type="number"
              min={0}
              max={100}
              value={form.passingPercentage}
              onChange={(e) =>
                patchForm({ passingPercentage: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label htmlFor="quiz-time">Time limit (seconds)</Label>
            <Input
              id="quiz-time"
              type="number"
              min={1}
              placeholder="No limit"
              value={form.timeLimitSeconds}
              onChange={(e) => patchForm({ timeLimitSeconds: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="quiz-attempts">Max attempts</Label>
            <Input
              id="quiz-attempts"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={form.maxAttempts}
              onChange={(e) => patchForm({ maxAttempts: e.target.value })}
            />
          </div>
          <div className="flex flex-col justify-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requireAllQuestions}
                onChange={(e) => patchForm({ requireAllQuestions: e.target.checked })}
              />
              Require all questions
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.randomizeQuestions}
                onChange={(e) => patchForm({ randomizeQuestions: e.target.checked })}
              />
              Randomize question order
            </label>
          </div>
          {wordpressQuizId != null && (
            <p className="sm:col-span-2 text-xs text-slate-400">
              LearnDash quiz ID: {wordpressQuizId}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">
            Questions ({questions.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={questionBusy}
              onClick={() => {
                setQuestionError(null);
                setEditing(emptyQuestionDraft("single_choice"));
              }}
            >
              Add single choice
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={questionBusy}
              onClick={() => {
                setQuestionError(null);
                setEditing(emptyQuestionDraft("multiple_choice"));
              }}
            >
              Add multiple choice
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={questionBusy}
              onClick={() => {
                setQuestionError(null);
                setEditing(emptyQuestionDraft("true_false"));
              }}
            >
              Add true/false
            </Button>
          </div>
        </div>

        {questionError && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {questionError}
          </p>
        )}

        {editing && (
          <div className="mb-6 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">
                {editing.questionId ? "Edit question" : "New question"} ({editing.questionType})
              </p>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
            <div>
              <Label>Question text</Label>
              <Textarea
                rows={3}
                value={editing.questionText}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, questionText: e.target.value } : prev
                  )
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Title (optional)</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                  }
                />
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.defaultPoints}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, defaultPoints: Number(e.target.value) || 0 }
                        : prev
                    )
                  }
                />
              </div>
            </div>
            <div>
              <Label>Explanation (optional)</Label>
              <Textarea
                rows={2}
                value={editing.explanation}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, explanation: e.target.value } : prev
                  )
                }
              />
            </div>

            {editing.questionType !== "essay" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  {editing.questionType !== "true_false" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                options: [
                                  ...prev.options,
                                  {
                                    key: crypto.randomUUID(),
                                    answerText: "",
                                    isCorrect: false,
                                    feedback: "",
                                  },
                                ],
                              }
                            : prev
                        )
                      }
                    >
                      Add option
                    </Button>
                  )}
                </div>
                {editing.options.map((opt, index) => (
                  <div
                    key={opt.key}
                    className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-3 sm:flex-row sm:items-start"
                  >
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type={
                          editing.questionType === "multiple_choice" ? "checkbox" : "radio"
                        }
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={() =>
                          setEditing((prev) => {
                            if (!prev) return prev;
                            if (prev.questionType === "multiple_choice") {
                              return {
                                ...prev,
                                options: prev.options.map((o, i) =>
                                  i === index ? { ...o, isCorrect: !o.isCorrect } : o
                                ),
                              };
                            }
                            return {
                              ...prev,
                              options: prev.options.map((o, i) => ({
                                ...o,
                                isCorrect: i === index,
                              })),
                            };
                          })
                        }
                      />
                      Correct
                    </label>
                    <Input
                      className="flex-1"
                      value={opt.answerText}
                      disabled={editing.questionType === "true_false"}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev
                            ? {
                                ...prev,
                                options: prev.options.map((o, i) =>
                                  i === index ? { ...o, answerText: e.target.value } : o
                                ),
                              }
                            : prev
                        )
                      }
                    />
                    {editing.questionType !== "true_false" && editing.options.length > 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditing((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  options: prev.options.filter((_, i) => i !== index),
                                }
                              : prev
                          )
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button disabled={questionBusy} onClick={() => void saveQuestion()}>
              {questionBusy ? "Saving…" : "Save question"}
            </Button>
          </div>
        )}

        {questions.length === 0 && !editing ? (
          <p className="text-sm text-slate-500">No questions yet. Add one to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {questions.map((q, index) => (
              <li key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {index + 1}. {q.questionText.slice(0, 120)}
                    {q.questionText.length > 120 ? "…" : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {q.questionType} · {q.defaultPoints} pt
                    {q.options.length > 0 ? ` · ${q.options.length} options` : ""}
                    {q.wordpressQuestionId != null ? ` · LD #${q.wordpressQuestionId}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionBusy || index === 0}
                    onClick={() => void moveQuestion(q.id, "up")}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionBusy || index === questions.length - 1}
                    onClick={() => void moveQuestion(q.id, "down")}
                  >
                    Down
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionBusy}
                    onClick={() => {
                      setQuestionError(null);
                      setEditing(fromServerQuestion(q));
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={questionBusy}
                    onClick={() => void removeQuestion(q.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.");

export const quizQuestionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "essay",
  "assessment",
]);

export const updateQuizSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(200),
  slug: slugField,
  description: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]),
  passingPercentage: z.number().min(0).max(100),
  timeLimitSeconds: z.number().int().positive().nullable().optional(),
  maxAttempts: z.number().int().positive().nullable().optional(),
  requireAllQuestions: z.boolean(),
  randomizeQuestions: z.boolean(),
});

export const questionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  answerText: z.string().trim().min(1, "Option text is required.").max(2000),
  isCorrect: z.boolean(),
  sortOrder: z.number().int().min(0),
  feedback: z.string().max(2000).optional().or(z.literal("")),
});

export const upsertQuizQuestionSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  questionId: z.string().uuid().optional(),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  questionText: z.string().trim().min(1, "Question text is required.").max(10000),
  questionType: quizQuestionTypeSchema,
  defaultPoints: z.number().min(0).max(1000).default(1),
  explanation: z.string().max(10000).optional().or(z.literal("")),
  pointsOverride: z.number().min(0).max(1000).nullable().optional(),
  options: z.array(questionOptionSchema).default([]),
});

export const deleteQuizQuestionSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
});

export const reorderQuizQuestionSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type UpsertQuizQuestionInput = z.infer<typeof upsertQuizQuestionSchema>;

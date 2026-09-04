import { z } from "zod";

export const startQuizAttemptSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  stepId: z.string().uuid().optional(),
});

export const quizAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  /** single_choice / true_false */
  selectedOptionId: z.string().uuid().optional(),
  /** multiple_choice */
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  /** essay / fill_blank / free text */
  text: z.string().max(50000).optional(),
});

export const submitQuizAttemptSchema = z.object({
  courseId: z.string().uuid(),
  quizId: z.string().uuid(),
  attemptId: z.string().uuid(),
  stepId: z.string().uuid().optional(),
  answers: z.array(quizAnswerInputSchema).min(1),
});

export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptSchema>;
export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;

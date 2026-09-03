import { z } from "zod";

export const toggleStepCompleteSchema = z.object({
  courseId: z.string().uuid(),
  kind: z.enum(["lesson", "quiz"]),
  contentId: z.string().uuid(),
  stepId: z.string().uuid().nullable(),
  completed: z.boolean(),
});

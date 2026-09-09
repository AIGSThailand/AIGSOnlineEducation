import { z } from "zod";

export const updateCourseAccessExpirationSchema = z.object({
  courseId: z.string().uuid(),
  accessExpirationEnabled: z.boolean(),
  accessPeriodDays: z
    .number()
    .int()
    .positive()
    .max(3650)
    .nullable()
    .optional(),
});

export const extendAccessSchema = z.object({
  courseId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1, "Select at least one student."),
  /**
   * ISO datetime or `YYYY-MM-DDTHH:mm` (datetime-local).
   * null clears expiration (unlimited).
   */
  expiresAt: z.union([z.string().min(1), z.null()]),
});

export const clearAccessExpirationSchema = z.object({
  courseId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1),
});

export type ExtendAccessInput = z.infer<typeof extendAccessSchema>;
export type UpdateCourseAccessExpirationInput = z.infer<
  typeof updateCourseAccessExpirationSchema
>;

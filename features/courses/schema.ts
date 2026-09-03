import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.");

export const createCourseSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  slug: slugField,
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  instructorId: z.string().uuid().optional(),
});

export const updateCourseSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(3).max(200).optional(),
  slug: slugField.optional(),
  description: z.string().optional(),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  promotionalVideoUrl: z.string().url().optional().or(z.literal("")),
  progressionType: z.enum(["linear", "free_form"]).optional(),
  accessType: z.enum(["open", "enrollment_required", "paid", "private"]).optional(),
  instructorIds: z.array(z.string().uuid()).optional(),
});

export const updateCourseStatusSchema = z.object({
  courseId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

export const stripeMappingSchema = z.object({
  courseId: z.string().uuid(),
  stripeProductId: z.string().trim().optional().or(z.literal("")),
  stripePriceId: z.string().trim().optional().or(z.literal("")),
});

export const moduleSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Module title must be at least 2 characters.").max(200),
  description: z.string().optional(),
});

export const lessonSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
  lessonId: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Lesson title must be at least 2 characters.").max(200),
  slug: slugField,
  content: z.string().optional(),
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const reorderModuleSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const reorderLessonSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});

export const moveLessonSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  targetModuleId: z.string().uuid(),
});

export const deleteModuleSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
});

export const deleteLessonSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export const reorderSectionsSchema = z.object({
  courseId: z.string().uuid(),
  sectionIds: z.array(z.string().uuid()).min(1),
});

const curriculumOrderItemSchema = z.object({
  kind: z.enum(["lesson", "quiz", "exam"]),
  id: z.string().uuid(),
});

export const reorderCurriculumSchema = z.object({
  courseId: z.string().uuid(),
  sections: z.array(
    z.object({
      sectionId: z.string().uuid(),
      items: z.array(curriculumOrderItemSchema),
    })
  ),
});

export const duplicateSectionSchema = z.object({
  courseId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

export const duplicateLessonSchema = z.object({
  courseId: z.string().uuid(),
  sectionId: z.string().uuid(),
  lessonId: z.string().uuid(),
});

export const duplicateQuizSchema = z.object({
  courseId: z.string().uuid(),
  sectionId: z.string().uuid(),
  quizId: z.string().uuid(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ModuleInput = z.infer<typeof moduleSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;

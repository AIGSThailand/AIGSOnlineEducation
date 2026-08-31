import { z } from "zod";

export const courseSchema = z.object({
  title: z.string().trim().min(3, { message: "Title must be at least 3 characters." }),
  slug: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens.",
    }),
  description: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
});

export const lessonSchema = z.object({
  moduleId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2, { message: "Title must be at least 2 characters." }),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens.",
    }),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;

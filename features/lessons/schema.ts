import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens.");

export const videoProviderSchema = z.enum([
  "youtube",
  "vimeo",
  "bunny",
  "cloudflare",
  "self_hosted",
  "external",
]);

export const completionTypeSchema = z.enum([
  "manual",
  "content_view",
  "video_watch",
  "quiz_pass",
  "assignment_submit",
  "automatic",
]);

export const dripTypeSchema = z.enum([
  "immediate",
  "days_after_enrollment",
  "fixed_date",
  "prerequisite",
]);

export const lessonResourceTypeSchema = z.enum([
  "pdf",
  "image",
  "document",
  "spreadsheet",
  "link",
  "download",
  "other",
]);

const optionalUrl = z
  .string()
  .trim()
  .url("Must be a valid URL.")
  .optional()
  .or(z.literal(""))
  .or(z.null());

export const updateLessonContentSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  moduleId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, "Lesson title must be at least 2 characters.").max(200),
  slug: slugField,
  excerpt: z.string().trim().max(500).optional().or(z.literal("")),
  /** Editable HTML — maps to lessons.content */
  contentHtml: z.string().optional().or(z.literal("")),
  contentJson: z.unknown().nullable().optional(),
  featuredImageUrl: optionalUrl,
  estimatedDurationMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  videoProvider: videoProviderSchema.nullable().optional(),
  videoUrl: optionalUrl,
  videoId: z.string().trim().max(200).nullable().optional().or(z.literal("")),
  videoDurationSeconds: z.number().int().positive().nullable().optional(),
  videoThumbnailUrl: optionalUrl,
  videoTranscript: z.string().max(500000).nullable().optional().or(z.literal("")),
  videoCaptionsUrl: optionalUrl,
  isRequired: z.boolean().optional(),
  completionType: completionTypeSchema.optional(),
  completionSettings: z.record(z.unknown()).optional(),
  dripType: dripTypeSchema.optional(),
  dripValue: z.record(z.unknown()).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const createLessonResourceSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  resourceType: lessonResourceTypeSchema.default("other"),
  title: z.string().trim().min(1, "Resource title is required.").max(200),
  url: optionalUrl,
  storagePath: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  isDownloadable: z.boolean().optional().default(true),
});

export const updateLessonResourceSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  resourceId: z.string().uuid(),
  resourceType: lessonResourceTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  url: optionalUrl,
  storagePath: z.string().trim().max(1000).nullable().optional().or(z.literal("")),
  isDownloadable: z.boolean().optional(),
});

export const deleteLessonResourceSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  resourceId: z.string().uuid(),
});

export const reorderLessonResourcesSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  resourceIds: z.array(z.string().uuid()).min(1),
});

export type UpdateLessonContentInput = z.infer<typeof updateLessonContentSchema>;
export type CreateLessonResourceInput = z.infer<typeof createLessonResourceSchema>;

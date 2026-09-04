"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";
import { lessonSlugExists } from "@/features/courses/queries";
import type { ActionResult } from "@/features/courses/types";
import {
  createLessonResourceSchema,
  deleteLessonResourceSchema,
  reorderLessonResourcesSchema,
  updateLessonContentSchema,
  updateLessonResourceSchema,
} from "@/features/lessons/schema";
import { lessonHasProgress, syncLessonToStep } from "@/features/courses/builder/sync";

type Db = Awaited<ReturnType<typeof createClient>>;

export type LessonResourceForEdit = {
  id: string;
  resourceType: string;
  title: string;
  url: string | null;
  storagePath: string | null;
  position: number;
  isDownloadable: boolean;
};

export type LessonForEdit = {
  id: string;
  moduleId: string | null;
  title: string;
  slug: string;
  contentHtml: string | null;
  contentJson: Record<string, unknown> | null;
  sourceContentHtml: string | null;
  excerpt: string | null;
  featuredImageUrl: string | null;
  estimatedDurationMinutes: number | null;
  videoProvider: string | null;
  videoUrl: string | null;
  videoId: string | null;
  videoDurationSeconds: number | null;
  videoThumbnailUrl: string | null;
  videoTranscript: string | null;
  videoCaptionsUrl: string | null;
  isRequired: boolean;
  completionType: string;
  completionSettings: Record<string, unknown>;
  dripType: string;
  dripValue: Record<string, unknown>;
  status: string;
  sortOrder: number;
  hasProgress: boolean;
  wordpressLessonId: number | null;
  createdAt: string;
  updatedAt: string;
  resources: LessonResourceForEdit[];
  /** TipTap may not preserve all imported markup; warn when source exists and differs. */
  hasSourceHtmlWarning: boolean;
};

function revalidateLessonPaths(courseId: string, lessonId: string) {
  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/preview`);
  revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function assertLessonOnCourse(
  supabase: Db,
  courseId: string,
  lessonId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("lessons")
    .select("id")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string }>();
  if (data?.id) return true;

  // Reusable lesson placed via course_steps may have a different primary course_id.
  const { data: step } = await supabase
    .from("course_steps")
    .select("id")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .eq("step_type", "lesson")
    .maybeSingle<{ id: string }>();
  return Boolean(step?.id);
}

export async function getLessonForEdit(
  courseId: string,
  lessonId: string
): Promise<ActionResult<LessonForEdit>> {
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, courseId, lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !lesson) {
    return { success: false, error: error?.message || "Lesson not found." };
  }

  const row = lesson as Record<string, unknown>;
  const contentHtml = (row.content as string | null) ?? null;
  const sourceContentHtml = (row.source_content_html as string | null) ?? null;

  const { data: resources } = await supabase
    .from("lesson_resources")
    .select("id, resource_type, title, url, storage_path, position, is_downloadable")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true })
    .returns<
      Array<{
        id: string;
        resource_type: string;
        title: string;
        url: string | null;
        storage_path: string | null;
        position: number;
        is_downloadable: boolean;
      }>
    >();

  const hasProgress = await lessonHasProgress(supabase, lessonId);
  const hasSourceHtmlWarning = Boolean(
    sourceContentHtml &&
      contentHtml &&
      sourceContentHtml.replace(/\s+/g, " ").trim() !== contentHtml.replace(/\s+/g, " ").trim()
  );

  return {
    success: true,
    data: {
      id: row.id as string,
      moduleId: (row.module_id as string | null) ?? null,
      title: row.title as string,
      slug: row.slug as string,
      contentHtml,
      contentJson: (row.content_json as Record<string, unknown> | null) ?? null,
      sourceContentHtml,
      excerpt: (row.excerpt as string | null) ?? null,
      featuredImageUrl: (row.featured_image_url as string | null) ?? null,
      estimatedDurationMinutes: (row.estimated_duration_minutes as number | null) ?? null,
      videoProvider: (row.video_provider as string | null) ?? null,
      videoUrl: (row.video_url as string | null) ?? null,
      videoId: (row.video_id as string | null) ?? null,
      videoDurationSeconds: (row.video_duration_seconds as number | null) ?? null,
      videoThumbnailUrl: (row.video_thumbnail_url as string | null) ?? null,
      videoTranscript: (row.video_transcript as string | null) ?? null,
      videoCaptionsUrl: (row.video_captions_url as string | null) ?? null,
      isRequired: (row.is_required as boolean) ?? true,
      completionType: (row.completion_type as string) || "manual",
      completionSettings: asRecord(row.completion_settings),
      dripType: (row.drip_type as string) || "immediate",
      dripValue: asRecord(row.drip_value),
      status: (row.status as string) || "draft",
      sortOrder: (row.sort_order as number) || 0,
      hasProgress,
      wordpressLessonId: (row.wordpress_lesson_id as number | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      resources: (resources || []).map((r) => ({
        id: r.id,
        resourceType: r.resource_type,
        title: r.title,
        url: r.url,
        storagePath: r.storage_path,
        position: r.position,
        isDownloadable: r.is_downloadable,
      })),
      hasSourceHtmlWarning,
    },
  };
}

/**
 * Autosave / explicit lesson update.
 * Never writes source_content_html — immutable migration/audit data.
 */
export async function updateLessonContentAction(input: unknown): Promise<ActionResult> {
  const parsed = updateLessonContentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid lesson data." };
  }

  const data = parsed.data;
  if (!(await canManageCourse(data.courseId))) {
    return { success: false, error: "Unauthorized." };
  }
  if (await lessonSlugExists(data.courseId, data.slug, data.lessonId)) {
    return { success: false, error: "This lesson slug is already in use." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, data.courseId, data.lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const patch: Record<string, unknown> = {
    title: data.title,
    slug: data.slug,
    excerpt: emptyToNull(data.excerpt) ,
    content: data.contentHtml ?? null,
    content_json: (data.contentJson as Record<string, unknown> | null) ?? null,
    featured_image_url: emptyToNull(data.featuredImageUrl ?? null),
    estimated_duration_minutes: data.estimatedDurationMinutes ?? null,
    video_provider: data.videoProvider ?? null,
    video_url: emptyToNull(data.videoUrl ?? null),
    video_id: emptyToNull(data.videoId ?? null),
    video_duration_seconds: data.videoDurationSeconds ?? null,
    video_thumbnail_url: emptyToNull(data.videoThumbnailUrl ?? null),
    video_transcript: emptyToNull(data.videoTranscript ?? null),
    video_captions_url: emptyToNull(data.videoCaptionsUrl ?? null),
    is_required: data.isRequired ?? true,
    completion_type: data.completionType ?? "manual",
    completion_settings: data.completionSettings ?? {},
    drip_type: data.dripType ?? "immediate",
    drip_value: data.dripValue ?? {},
    status: data.status || "draft",
    updated_by: user?.id ?? null,
  };

  if (data.moduleId !== undefined) {
    patch.module_id = data.moduleId;
  }

  const { error } = await supabase
    .from("lessons")
    .update(patch as never)
    .eq("id", data.lessonId);

  if (error) return { success: false, error: error.message };

  // Keep course_steps.is_required in sync when present.
  if (data.isRequired !== undefined) {
    await supabase
      .from("course_steps")
      .update({ is_required: data.isRequired } as never)
      .eq("course_id", data.courseId)
      .eq("lesson_id", data.lessonId)
      .eq("step_type", "lesson");
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, module_id, sort_order")
    .eq("id", data.lessonId)
    .single<{ id: string; course_id: string; module_id: string | null; sort_order: number }>();

  if (lesson) {
    await syncLessonToStep(supabase, {
      id: lesson.id,
      course_id: data.courseId,
      module_id: lesson.module_id,
      sort_order: lesson.sort_order,
    });
  }

  revalidateLessonPaths(data.courseId, data.lessonId);
  return { success: true };
}

export async function createLessonResourceAction(
  input: unknown
): Promise<ActionResult<{ resourceId: string }>> {
  const parsed = createLessonResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid resource." };
  }

  const data = parsed.data;
  if (!(await canManageCourse(data.courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, data.courseId, data.lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  const { data: existing } = await supabase
    .from("lesson_resources")
    .select("position")
    .eq("lesson_id", data.lessonId)
    .returns<Array<{ position: number }>>();
  const nextPosition =
    (existing || []).reduce((max, row) => Math.max(max, row.position), -1) + 1;

  const { data: created, error } = await supabase
    .from("lesson_resources")
    .insert({
      lesson_id: data.lessonId,
      resource_type: data.resourceType,
      title: data.title,
      url: emptyToNull(data.url ?? null),
      storage_path: emptyToNull(data.storagePath ?? null),
      position: nextPosition,
      is_downloadable: data.isDownloadable ?? true,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    return { success: false, error: error?.message || "Failed to create resource." };
  }

  revalidateLessonPaths(data.courseId, data.lessonId);
  return { success: true, data: { resourceId: created.id } };
}

export async function updateLessonResourceAction(input: unknown): Promise<ActionResult> {
  const parsed = updateLessonResourceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid resource." };
  }

  const data = parsed.data;
  if (!(await canManageCourse(data.courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, data.courseId, data.lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  const patch: Record<string, unknown> = {};
  if (data.resourceType !== undefined) patch.resource_type = data.resourceType;
  if (data.title !== undefined) patch.title = data.title;
  if (data.url !== undefined) patch.url = emptyToNull(data.url);
  if (data.storagePath !== undefined) patch.storage_path = emptyToNull(data.storagePath);
  if (data.isDownloadable !== undefined) patch.is_downloadable = data.isDownloadable;

  const { error } = await supabase
    .from("lesson_resources")
    .update(patch as never)
    .eq("id", data.resourceId)
    .eq("lesson_id", data.lessonId);

  if (error) return { success: false, error: error.message };

  revalidateLessonPaths(data.courseId, data.lessonId);
  return { success: true };
}

export async function deleteLessonResourceAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteLessonResourceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, lessonId, resourceId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, courseId, lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  const { error } = await supabase
    .from("lesson_resources")
    .delete()
    .eq("id", resourceId)
    .eq("lesson_id", lessonId);

  if (error) return { success: false, error: error.message };

  revalidateLessonPaths(courseId, lessonId);
  return { success: true };
}

export async function reorderLessonResourcesAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderLessonResourcesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, lessonId, resourceIds } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (!(await assertLessonOnCourse(supabase, courseId, lessonId))) {
    return { success: false, error: "Lesson not found on this course." };
  }

  // Two-phase update avoids transient unique conflicts if any exist.
  for (let i = 0; i < resourceIds.length; i++) {
    const { error } = await supabase
      .from("lesson_resources")
      .update({ position: -(i + 1) } as never)
      .eq("id", resourceIds[i])
      .eq("lesson_id", lessonId);
    if (error) return { success: false, error: error.message };
  }
  for (let i = 0; i < resourceIds.length; i++) {
    const { error } = await supabase
      .from("lesson_resources")
      .update({ position: i } as never)
      .eq("id", resourceIds[i])
      .eq("lesson_id", lessonId);
    if (error) return { success: false, error: error.message };
  }

  revalidateLessonPaths(courseId, lessonId);
  return { success: true };
}

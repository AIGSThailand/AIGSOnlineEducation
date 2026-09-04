"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";
import {
  deleteLessonSchema,
  deleteModuleSchema,
  duplicateLessonSchema,
  duplicateQuizSchema,
  duplicateSectionSchema,
  createQuizSchema,
  lessonSchema,
  moduleSchema,
  moveLessonSchema,
  reorderCurriculumSchema,
  reorderLessonSchema,
  reorderModuleSchema,
  reorderSectionsSchema,
} from "@/features/courses/schema";
import {
  createQuizRecord,
  duplicateLessonRecord,
  duplicateQuizRecord,
  duplicateSectionRecord,
} from "@/features/courses/builder/duplicate";
import {
  persistCurriculumOrder,
  persistSectionOrder,
} from "@/features/courses/builder/persist-order";
import { lessonSlugExists } from "@/features/courses/queries";
import type { ActionResult } from "@/features/courses/types";
import { nextSortOrder, slugifyTitle, swapSortOrder } from "@/features/courses/builder/ordering";
import {
  lessonHasProgress,
  moduleHasProgress,
  removeLessonStep,
  removeSection,
  swapLessonStepSortOrders,
  syncLessonToStep,
  syncModuleToSection,
} from "@/features/courses/builder/sync";

function revalidateBuilder(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/preview`);
}

export async function createModuleAction(
  input: unknown
): Promise<ActionResult<{ moduleId: string }>> {
  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid module data." };
  }

  const { courseId, title, description } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: existingModules } = await supabase
    .from("modules")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .returns<{ id: string; sort_order: number }[]>();

  const sortOrder = nextSortOrder(
    (existingModules || []).map((m) => ({ id: m.id, sortOrder: m.sort_order }))
  );

  const { data: moduleRow, error } = await supabase
    .from("modules")
    .insert({ course_id: courseId, title, sort_order: sortOrder } as never)
    .select("id, course_id, title, sort_order")
    .single<{ id: string; course_id: string; title: string; sort_order: number }>();

  if (error || !moduleRow) {
    return { success: false, error: error?.message || "Failed to create module." };
  }

  await syncModuleToSection(supabase, moduleRow);

  if (description) {
    await supabase
      .from("course_sections")
      .update({ description } as never)
      .eq("id", moduleRow.id);
  }

  revalidateBuilder(courseId);
  return { success: true, data: { moduleId: moduleRow.id } };
}

export async function updateModuleAction(input: unknown): Promise<ActionResult> {
  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid module data." };
  }

  const { courseId, moduleId, title, description } = parsed.data;
  if (!moduleId) return { success: false, error: "Module ID is required." };
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ title } as never)
    .eq("id", moduleId);
  if (error) return { success: false, error: error.message };

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id, course_id, title, sort_order")
    .eq("id", moduleId)
    .single<{ id: string; course_id: string; title: string; sort_order: number }>();

  if (moduleRow) {
    await syncModuleToSection(supabase, moduleRow);
    if (description !== undefined) {
      await supabase
        .from("course_sections")
        .update({ description } as never)
        .eq("id", moduleId);
    }
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function deleteModuleAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request." };
  }

  const { courseId, moduleId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();

  if (await moduleHasProgress(supabase, moduleId)) {
    return {
      success: false,
      error:
        "This module has lessons with student progress. Remove or reassign lessons individually. Permanent deletion is not available while progress records exist.",
    };
  }

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("module_id", moduleId)
    .returns<{ id: string }[]>();

  for (const lesson of lessons || []) {
    if (await lessonHasProgress(supabase, lesson.id)) {
      return {
        success: false,
        error: "A lesson in this module has student progress. Deletion is blocked.",
      };
    }
    await removeLessonStep(supabase, courseId, lesson.id);
  }

  await supabase.from("lessons").delete().eq("module_id", moduleId);
  await supabase.from("modules").delete().eq("id", moduleId);
  await removeSection(supabase, moduleId);

  revalidateBuilder(courseId);
  return { success: true };
}

export async function reorderModuleAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderModuleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, moduleId, direction } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("id, sort_order")
    .eq("course_id", courseId)
    .returns<{ id: string; sort_order: number }[]>();

  const swapped = swapSortOrder(
    (modules || []).map((m) => ({ id: m.id, sortOrder: m.sort_order })),
    moduleId,
    direction
  );
  if (!swapped) return { success: true };

  for (const item of swapped) {
    await supabase
      .from("modules")
      .update({ sort_order: item.sortOrder } as never)
      .eq("id", item.id);
    const { data: mod } = await supabase
      .from("modules")
      .select("id, course_id, title, sort_order")
      .eq("id", item.id)
      .single<{ id: string; course_id: string; title: string; sort_order: number }>();
    if (mod) await syncModuleToSection(supabase, mod);
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function createLessonAction(
  input: unknown
): Promise<ActionResult<{ lessonId: string }>> {
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid lesson data." };
  }

  const { courseId, moduleId, title, slug: rawSlug, content, videoUrl, status } = parsed.data;
  const slug = rawSlug || slugifyTitle(title);

  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }
  if (await lessonSlugExists(courseId, slug)) {
    return { success: false, error: "This lesson slug is already in use in this course." };
  }

  const supabase = await createClient();
  const { data: moduleLessons } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("module_id", moduleId)
    .returns<{ id: string; sort_order: number }[]>();

  const sortOrder = nextSortOrder(
    (moduleLessons || []).map((l) => ({ id: l.id, sortOrder: l.sort_order }))
  );

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      course_id: courseId,
      module_id: moduleId,
      title,
      slug,
      content: content || null,
      video_url: videoUrl || null,
      sort_order: sortOrder,
      status: status || "draft",
    } as never)
    .select("id, course_id, module_id, sort_order")
    .single<{ id: string; course_id: string; module_id: string; sort_order: number }>();

  if (error || !lesson) {
    return { success: false, error: error?.message || "Failed to create lesson." };
  }

  await syncLessonToStep(supabase, lesson);
  revalidateBuilder(courseId);
  return { success: true, data: { lessonId: lesson.id } };
}

export async function createQuizAction(
  input: unknown
): Promise<ActionResult<{ quizId: string }>> {
  const parsed = createQuizSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid quiz data." };
  }

  const { courseId, sectionId, title, slug, status } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    const quizId = await createQuizRecord(supabase, courseId, sectionId, {
      title,
      slug,
      status,
    });
    revalidateBuilder(courseId);
    return { success: true, data: { quizId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create quiz.",
    };
  }
}

export async function updateLessonAction(input: unknown): Promise<ActionResult> {
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid lesson data." };
  }

  const { courseId, moduleId, lessonId, title, slug, content, excerpt, videoUrl, status } =
    parsed.data;
  if (!lessonId) return { success: false, error: "Lesson ID is required." };
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }
  if (slug && (await lessonSlugExists(courseId, slug, lessonId))) {
    return { success: false, error: "This lesson slug is already in use." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      title,
      slug,
      content: content ?? null,
      excerpt: excerpt || null,
      video_url: videoUrl || null,
      module_id: moduleId,
      status: status || "draft",
    } as never)
    .eq("id", lessonId);

  if (error) return { success: false, error: error.message };

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, module_id, sort_order")
    .eq("id", lessonId)
    .single<{ id: string; course_id: string; module_id: string; sort_order: number }>();

  if (lesson) await syncLessonToStep(supabase, lesson);

  revalidateBuilder(courseId);
  return { success: true };
}

export async function deleteLessonAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteLessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, lessonId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  if (await lessonHasProgress(supabase, lessonId)) {
    return {
      success: false,
      error:
        "This lesson has student progress records. Permanent deletion is not available. Historical progress will be preserved.",
    };
  }

  await removeLessonStep(supabase, courseId, lessonId);
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { success: false, error: error.message };

  revalidateBuilder(courseId);
  return { success: true };
}

export async function reorderLessonAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderLessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, lessonId, direction } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, module_id, sort_order")
    .eq("id", lessonId)
    .maybeSingle<{ id: string; module_id: string; sort_order: number }>();

  if (!lesson?.module_id) return { success: false, error: "Lesson not found." };

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("module_id", lesson.module_id)
    .returns<{ id: string; sort_order: number }[]>();

  const swapped = swapSortOrder(
    (lessons || []).map((l) => ({ id: l.id, sortOrder: l.sort_order })),
    lessonId,
    direction
  );
  if (!swapped) return { success: true };

  const sorted = [...(lessons || [])].sort((a, b) => a.sort_order - b.sort_order);
  const index = sorted.findIndex((l) => l.id === lessonId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const otherLessonId = sorted[targetIndex]?.id;

  for (const item of swapped) {
    const changed = sorted.find((l) => l.id === item.id);
    if (changed && changed.sort_order !== item.sortOrder) {
      await supabase
        .from("lessons")
        .update({ sort_order: item.sortOrder } as never)
        .eq("id", item.id);
    }
  }

  if (otherLessonId) {
    await swapLessonStepSortOrders(supabase, courseId, lessonId, otherLessonId);
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function moveLessonAction(input: unknown): Promise<ActionResult> {
  const parsed = moveLessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, lessonId, targetModuleId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: targetLessons } = await supabase
    .from("lessons")
    .select("id, sort_order")
    .eq("module_id", targetModuleId)
    .returns<{ id: string; sort_order: number }[]>();

  const sortOrder = nextSortOrder(
    (targetLessons || []).map((l) => ({ id: l.id, sortOrder: l.sort_order }))
  );

  const { error } = await supabase
    .from("lessons")
    .update({ module_id: targetModuleId, sort_order: sortOrder } as never)
    .eq("id", lessonId);

  if (error) return { success: false, error: error.message };

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, module_id, sort_order")
    .eq("id", lessonId)
    .single<{ id: string; course_id: string; module_id: string; sort_order: number }>();

  if (lesson) await syncLessonToStep(supabase, lesson);

  revalidateBuilder(courseId);
  return { success: true };
}

export async function reorderSectionsAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderSectionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, sectionIds } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    await persistSectionOrder(supabase, courseId, sectionIds);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reorder sections.",
    };
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function reorderCurriculumAction(input: unknown): Promise<ActionResult> {
  const parsed = reorderCurriculumSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, sections } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    await persistCurriculumOrder(supabase, courseId, sections);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reorder curriculum.",
    };
  }

  revalidateBuilder(courseId);
  return { success: true };
}

export async function duplicateSectionAction(
  input: unknown
): Promise<ActionResult<{ sectionId: string }>> {
  const parsed = duplicateSectionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, sectionId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    const newSectionId = await duplicateSectionRecord(supabase, courseId, sectionId);
    revalidateBuilder(courseId);
    return { success: true, data: { sectionId: newSectionId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to duplicate section.",
    };
  }
}

export async function duplicateLessonAction(
  input: unknown
): Promise<ActionResult<{ lessonId: string }>> {
  const parsed = duplicateLessonSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, sectionId, lessonId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    const newLessonId = await duplicateLessonRecord(supabase, courseId, sectionId, lessonId);
    revalidateBuilder(courseId);
    return { success: true, data: { lessonId: newLessonId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to duplicate lesson.",
    };
  }
}

export async function duplicateQuizAction(
  input: unknown
): Promise<ActionResult<{ quizId: string }>> {
  const parsed = duplicateQuizSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request." };

  const { courseId, sectionId, quizId } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  try {
    const newQuizId = await duplicateQuizRecord(supabase, courseId, sectionId, quizId);
    revalidateBuilder(courseId);
    return { success: true, data: { quizId: newQuizId } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to duplicate quiz.",
    };
  }
}

export async function getLessonForEdit(
  courseId: string,
  lessonId: string
): Promise<
  ActionResult<{
    id: string;
    moduleId: string | null;
    title: string;
    slug: string;
    content: string | null;
    excerpt: string | null;
    videoUrl: string | null;
    status: string;
    sortOrder: number;
    hasProgress: boolean;
    wordpressLessonId: number | null;
  }>
> {
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle<{
      id: string;
      module_id: string | null;
      title: string;
      slug: string;
      content: string | null;
      excerpt: string | null;
      video_url: string | null;
      status: string;
      sort_order: number;
      wordpress_lesson_id: number | null;
    }>();

  if (!lesson) return { success: false, error: "Lesson not found." };

  const hasProgress = await lessonHasProgress(supabase, lessonId);

  return {
    success: true,
    data: {
      id: lesson.id,
      moduleId: lesson.module_id,
      title: lesson.title,
      slug: lesson.slug,
      content: lesson.content,
      excerpt: lesson.excerpt,
      videoUrl: lesson.video_url,
      status: lesson.status,
      sortOrder: lesson.sort_order,
      hasProgress,
      wordpressLessonId: lesson.wordpress_lesson_id,
    },
  };
}

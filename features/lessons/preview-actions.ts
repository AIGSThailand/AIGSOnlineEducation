"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";

const settingSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  enabled: z.boolean(),
});

export async function saveLessonPreview(input: unknown) {
  const parsed = settingSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Invalid preview settings." };
  const { courseId, lessonId, enabled } = parsed.data;
  if (!(await canManageCourse(courseId)))
    return { success: false as const, error: "Unauthorized." };
  const db = await createClient();
  const { error } = await db.rpc(
    "set_lesson_preview" as never,
    { p_course_id: courseId, p_lesson_id: lessonId, p_enabled: enabled } as never
  );
  if (error) return { success: false as const, error: error.message };
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/lessons/${lessonId}`);
  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  return { success: true as const };
}

export async function loadLessonPreviewSetting(courseId: string, lessonId: string) {
  if (
    !settingSchema.safeParse({ courseId, lessonId, enabled: false }).success ||
    !(await canManageCourse(courseId))
  ) {
    return { success: false as const, error: "Unauthorized." };
  }
  const db = await createClient();
  const { data, error } = await db.rpc(
    "get_lesson_preview_setting" as never,
    { p_course_id: courseId, p_lesson_id: lessonId } as never
  );
  return error
    ? { success: false as const, error: error.message }
    : { success: true as const, enabled: Boolean(data) };
}

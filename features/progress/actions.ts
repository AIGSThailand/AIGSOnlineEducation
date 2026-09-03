"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canAccessCourse, getCurrentUser } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";
import { toggleStepCompleteSchema } from "./schema";
import type { ActionResult } from "@/features/curriculum/types";

export async function toggleStepCompleteAction(
  input: unknown
): Promise<ActionResult<{ completed: boolean }>> {
  const parsed = toggleStepCompleteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid progress data." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "You must be signed in." };
  }

  const { courseId, kind, contentId, stepId, completed } = parsed.data;

  if (!(await canAccessCourse(courseId))) {
    return { success: false, error: "You do not have access to this course." };
  }

  const player = await getCoursePlayerData(courseId, user.id);
  if (!player) {
    return { success: false, error: "Course not found." };
  }

  const step = findStepByContent(player.flatSteps, kind, contentId);
  if (!step) {
    return { success: false, error: "This step is not in the course." };
  }

  const bypass = await canManageCourse(courseId);
  const locked = lockedStepKeys(
    player.flatSteps,
    new Set(player.completedKeys),
    player.progressionType === "linear",
    bypass
  );

  if (completed && locked.has(step.key)) {
    return { success: false, error: "Complete previous steps first." };
  }

  const supabase = await createClient();
  const completedAt = completed ? new Date().toISOString() : null;
  const resolvedStepId = stepId ?? step.stepId;

  if (kind === "lesson") {
    const { error } = await supabase.from("lesson_progress").upsert(
      {
        student_id: user.id,
        course_id: courseId,
        lesson_id: contentId,
        completed,
        completed_at: completedAt,
      } as never,
      { onConflict: "student_id,lesson_id" }
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  if (resolvedStepId) {
    const { error } = await supabase.from("step_progress").upsert(
      {
        student_id: user.id,
        course_id: courseId,
        course_step_id: resolvedStepId,
        completed,
        completed_at: completedAt,
      } as never,
      { onConflict: "student_id,course_step_id" }
    );
    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/courses/${courseId}`, "layout");
  return { success: true, data: { completed } };
}

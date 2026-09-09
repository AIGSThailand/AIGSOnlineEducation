"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";
import {
  clearAccessExpirationSchema,
  extendAccessSchema,
  updateCourseAccessExpirationSchema,
} from "@/features/enrollments/schema";
import {
  listCourseEnrollmentsForExtend,
  type CourseEnrollmentAccessRow,
} from "@/features/enrollments/queries";
import type { ActionResult } from "@/features/courses/types";

export type { CourseEnrollmentAccessRow };

function revalidateExtendPaths(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}/edit`);
  revalidatePath(`/instructor/courses/${courseId}/edit`);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/student/dashboard");
  revalidatePath("/admin/enrollments");
}

export async function listCourseEnrollmentsForExtendAction(
  courseId: string
): Promise<CourseEnrollmentAccessRow[]> {
  return listCourseEnrollmentsForExtend(courseId);
}

/**
 * Course-level defaults (LearnDash Access Settings → Course Access Expiration).
 */
export async function updateCourseAccessExpirationAction(
  input: unknown
): Promise<ActionResult> {
  const parsed = updateCourseAccessExpirationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid request." };
  }

  const { courseId, accessExpirationEnabled, accessPeriodDays } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  if (accessExpirationEnabled && (accessPeriodDays == null || accessPeriodDays <= 0)) {
    return {
      success: false,
      error: "Access period (days) is required when expiration is enabled.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({
      access_expiration_enabled: accessExpirationEnabled,
      access_period_days: accessExpirationEnabled ? accessPeriodDays : null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", courseId);

  if (error) return { success: false, error: error.message };

  revalidateExtendPaths(courseId);
  return { success: true };
}

/**
 * LearnDash Extend Access: set a new expires_at for selected enrolled students.
 * Passing expiresAt=null removes the expiration (unlimited access).
 * Reactivates enrollments that were status=expired.
 */
export async function extendAccessAction(
  input: unknown
): Promise<ActionResult<{ updated: number }>> {
  const parsed = extendAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid request." };
  }

  const { courseId, studentIds, expiresAt: expiresAtRaw } = parsed.data;
  if (!(await canManageCourse(courseId))) {
    return { success: false, error: "Unauthorized." };
  }

  let expiresAt: string | null = null;
  if (expiresAtRaw != null) {
    const when = new Date(expiresAtRaw);
    if (Number.isNaN(when.getTime())) {
      return { success: false, error: "Invalid expiration date." };
    }
    expiresAt = when.toISOString();
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("enrollments")
    .update({
      expires_at: expiresAt,
      status: "active",
      updated_at: nowIso,
    } as never)
    .eq("course_id", courseId)
    .in("student_id", studentIds)
    .in("status", ["active", "expired", "completed"])
    .select("id");

  if (error) return { success: false, error: error.message };

  const updated = data?.length ?? 0;
  if (updated === 0) {
    return {
      success: false,
      error: "No matching enrollments found for the selected students.",
    };
  }

  revalidateExtendPaths(courseId);
  return { success: true, data: { updated } };
}

/** Shortcut: clear expires_at (unlimited) for selected students. */
export async function clearAccessExpirationAction(
  input: unknown
): Promise<ActionResult<{ updated: number }>> {
  const parsed = clearAccessExpirationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid request." };
  }

  return extendAccessAction({
    courseId: parsed.data.courseId,
    studentIds: parsed.data.studentIds,
    expiresAt: null,
  });
}

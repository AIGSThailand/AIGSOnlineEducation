import { createClient } from "@/lib/supabase/server";
import { canAccessCourse } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import type { MediaAssetKind } from "@/features/media/types";

/**
 * Marketing assets may be shown on the public catalog when the course is published.
 * Lesson/attachment assets require course content access (paid / enrolled / staff).
 */
export function isProtectedMediaKind(kind: MediaAssetKind): boolean {
  return kind === "lesson-image" || kind === "attachment";
}

export async function authorizeMediaRead(
  courseId: string,
  kind: MediaAssetKind
): Promise<boolean> {
  if (await canManageCourse(courseId)) {
    return true;
  }

  if (isProtectedMediaKind(kind)) {
    return canAccessCourse(courseId);
  }

  // thumbnail / promo — published catalog OR enrolled/staff
  if (await canAccessCourse(courseId)) {
    return true;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("status")
    .eq("id", courseId)
    .maybeSingle<{ status: string }>();

  return data?.status === "published";
}

import { createClient } from "@/lib/supabase/server";
import { canAccessCourse } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import type { MediaAssetKind } from "@/features/media/types";
import { descriptionReferencesImage } from "./public-description";

/**
 * Marketing assets may be shown on the public catalog when the course is published.
 * Lesson/attachment assets require course content access (paid / enrolled / staff).
 */
export function isProtectedMediaKind(kind: MediaAssetKind): boolean {
  return kind === "lesson-image" || kind === "attachment";
}

export async function authorizeMediaRead(
  courseId: string,
  kind: MediaAssetKind,
  key?: string
): Promise<boolean> {
  if (await canManageCourse(courseId)) {
    return true;
  }

  if (isProtectedMediaKind(kind)) {
    if (await canAccessCourse(courseId)) return true;
    if (kind !== "lesson-image" || !key) return false;
    const supabase = await createClient();
    const { data: course } = await supabase
      .from("courses")
      .select("description")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle<{ description: string | null }>();
    return descriptionReferencesImage(course?.description ?? null, key);
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

/** Bundle catalog thumbnails — readable when the group is active (or admin). */
export async function authorizeGroupMediaRead(groupId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role: string }>();
    if (profile?.role === "admin") return true;
  }

  const { data } = await supabase
    .from("groups")
    .select("status")
    .eq("id", groupId)
    .maybeSingle<{ status: string }>();

  return data?.status === "active";
}

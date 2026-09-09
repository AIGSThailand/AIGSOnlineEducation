import { createClient } from "@/lib/supabase/server";
import { canManageCourse } from "@/features/courses/permissions";
import type { CourseEnrollmentAccessRow } from "@/features/enrollments/types";

export type { CourseEnrollmentAccessRow } from "@/features/enrollments/types";

function displayName(row: CourseEnrollmentAccessRow): string {
  const name = `${row.firstName || ""} ${row.lastName || ""}`.trim();
  return name || row.email;
}

/**
 * Enrollments for Extend Access UI (managers only).
 * Includes active + expired so access can be extended again.
 */
export async function listCourseEnrollmentsForExtend(
  courseId: string
): Promise<CourseEnrollmentAccessRow[]> {
  if (!(await canManageCourse(courseId))) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      student_id,
      status,
      enrollment_source,
      enrolled_at,
      expires_at,
      profiles:student_id (
        email,
        first_name,
        last_name
      )
    `
    )
    .eq("course_id", courseId)
    .in("status", ["active", "expired", "completed"])
    .order("enrolled_at", { ascending: false });

  if (error || !data) return [];

  type Raw = {
    id: string;
    student_id: string;
    status: string;
    enrollment_source: string;
    enrolled_at: string;
    expires_at: string | null;
    profiles:
      | { email: string; first_name: string | null; last_name: string | null }
      | { email: string; first_name: string | null; last_name: string | null }[]
      | null;
  };

  return (data as unknown as Raw[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      enrollmentId: row.id,
      studentId: row.student_id,
      status: row.status,
      enrollmentSource: row.enrollment_source,
      enrolledAt: row.enrolled_at,
      expiresAt: row.expires_at,
      email: profile?.email || "(no email)",
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
    };
  });
}

export function enrollmentLabel(row: CourseEnrollmentAccessRow): string {
  return displayName(row);
}

/** Compute default expires_at from course access period settings. */
export function computeExpiresAtFromPeriod(
  enrolledAt: Date,
  accessExpirationEnabled: boolean,
  accessPeriodDays: number | null
): string | null {
  if (!accessExpirationEnabled || !accessPeriodDays || accessPeriodDays <= 0) {
    return null;
  }
  const end = new Date(enrolledAt.getTime());
  end.setUTCDate(end.getUTCDate() + accessPeriodDays);
  return end.toISOString();
}

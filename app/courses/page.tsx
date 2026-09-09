import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { PublicCatalog } from "@/components/courses/public-catalog";
import { SectionHeader } from "@/components/public/section-header";
import type { Database } from "@/types/database.types";

export default async function CourseCatalogPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: courses, error } = await supabase
    .from("courses")
    .select(
      `
      id,
      title,
      slug,
      description,
      excerpt,
      status,
      thumbnail_url,
      access_type,
      wordpress_course_id,
      created_at,
      updated_at
    `
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  let enrolledCourseIds: string[] = [];
  if (user) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id, expires_at")
      .eq("student_id", user.id)
      .eq("status", "active");

    const now = Date.now();
    const rawEnrollments =
      (enrollments as unknown as { course_id: string; expires_at: string | null }[] | null) || [];
    enrolledCourseIds = rawEnrollments
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)
      .map((e) => e.course_id);
  }

  type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
  const courseList = (courses as CourseRow[] | null) || [];

  return (
    <div className="public-container public-section">
      <SectionHeader
        eyebrow="Course catalog"
        title="Explore AIGS online courses"
        description="Browse published programs. Open a course to review the curriculum before you enroll."
        headingLevel="h1"
      />
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8"
        >
          <h2 className="text-lg font-semibold">We could not load the courses</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Please refresh the page to try again.
          </p>
        </div>
      ) : (
        <PublicCatalog courses={courseList} enrolledCourseIds={enrolledCourseIds} />
      )}
    </div>
  );
}

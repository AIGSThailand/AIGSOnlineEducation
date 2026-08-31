import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { CourseCard } from "@/components/courses/course-card";
import type { Database } from "@/types/database.types";

export default async function CourseCatalogPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Fetch published courses
  const { data: courses } = await supabase
    .from("courses")
    .select(`
      id,
      title,
      slug,
      description,
      status,
      thumbnail_url,
      wordpress_course_id,
      created_at,
      updated_at
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // Fetch user enrollments if logged in
  let enrolledCourseIds: string[] = [];
  if (user) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id)
      .eq("status", "active");

    enrolledCourseIds = enrollments?.map((e) => e.course_id) || [];
  }

  type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
  const courseList = (courses as CourseRow[] | null) || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Course Catalog
        </h1>
        <p className="mt-2 text-base text-slate-600">
          Explore our complete selection of professional training courses.
        </p>
      </div>

      {courseList.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courseList.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={enrolledCourseIds.includes(course.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-slate-500">
          No published courses available at the moment.
        </div>
      )}
    </div>
  );
}

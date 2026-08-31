import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { CourseCard } from "@/components/courses/course-card";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CourseWithInstructors } from "@/types/lms.types";

export default async function StudentCoursesPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      id,
      status,
      course:courses(
        id,
        title,
        slug,
        description,
        status,
        thumbnail_url,
        wordpress_course_id,
        created_at,
        updated_at
      )
    `)
    .eq("student_id", user?.id || "");

  const courses: CourseWithInstructors[] =
    enrollments
      ?.map((e) => (Array.isArray(e.course) ? e.course[0] : e.course))
      .filter((c): c is CourseWithInstructors => !!c) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Enrolled Courses
          </h1>
          <p className="text-sm text-slate-500">
            Access your curriculum and video lessons
          </p>
        </div>
        <Link href="/courses">
          <Button variant="outline">Explore New Courses</Button>
        </Link>
      </div>

      {courses.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} isEnrolled />
          ))}
        </div>
      ) : (
        <Card className="py-12 text-center">
          <CardTitle className="mb-2">You have not enrolled in any courses yet</CardTitle>
          <p className="mb-6 text-sm text-slate-500">
            Discover courses covering AI engineering, web systems, and data science.
          </p>
          <Link href="/courses">
            <Button>Explore Course Catalog</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

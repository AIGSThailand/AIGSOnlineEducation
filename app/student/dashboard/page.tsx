import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CourseCard } from "@/components/courses/course-card";
import { BookOpen, CheckCircle, Clock, Award } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CourseWithInstructors } from "@/types/lms.types";

export default async function StudentDashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  // Fetch active enrollments with course details
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrolled_at,
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
    `
    )
    .eq("student_id", user?.id || "")
    .eq("status", "active");

  const { count: completedLessonsCount } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user?.id || "")
    .eq("completed", true);

  interface EnrollmentWithCourse {
    id: string;
    status: string;
    enrolled_at: string;
    course: CourseWithInstructors | CourseWithInstructors[] | null;
  }

  const enrollmentList = (enrollments as unknown as EnrollmentWithCourse[] | null) || [];

  const activeCourses: CourseWithInstructors[] = enrollmentList
    .map((e) => (Array.isArray(e.course) ? e.course[0] : e.course))
    .filter((c): c is CourseWithInstructors => !!c);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Dashboard</h1>
          <p className="text-sm text-slate-500">
            Track your ongoing courses, completed lessons, and certifications
          </p>
        </div>
        <Link href="/courses">
          <Button variant="outline">Browse Catalog</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Enrolled Courses"
          value={activeCourses.length}
          description="Active learning paths"
          icon={BookOpen}
        />
        <StatCard
          title="Completed Lessons"
          value={completedLessonsCount ?? 0}
          description="Lessons finished"
          icon={CheckCircle}
        />
        <StatCard title="Time Spent" value="—" description="Weekly study time" icon={Clock} />
        <StatCard title="Certificates" value="0" description="Earned credentials" icon={Award} />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Continue Learning</h2>
          <Link
            href="/student/courses"
            className="text-sm font-semibold text-brand-600 hover:text-brand-500"
          >
            View all courses →
          </Link>
        </div>

        {activeCourses.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeCourses.map((course) => (
              <CourseCard key={course.id} course={course} isEnrolled />
            ))}
          </div>
        ) : (
          <Card className="py-10 text-center">
            <CardTitle className="mb-2">No active course enrollments</CardTitle>
            <p className="mb-6 text-sm text-slate-500">
              Browse our catalog of professional courses to begin learning today.
            </p>
            <Link href="/courses">
              <Button>Browse All Courses</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}

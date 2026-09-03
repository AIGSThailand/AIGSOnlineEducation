import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, Users, CheckCircle, FileText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InstructorDashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  interface AssignedItem {
    course_id: string;
    course:
      | { id: string; title: string; status: string }
      | { id: string; title: string; status: string }[]
      | null;
  }

  // Fetch instructor's assigned courses
  const { data: rawAssigned } = await supabase
    .from("course_instructors")
    .select(
      `
      course_id,
      course:courses(id, title, status)
    `
    )
    .eq("instructor_id", user?.id || "");

  const assignedCourses = (rawAssigned as unknown as AssignedItem[] | null) || [];
  const courseIds = assignedCourses.map((ac) => ac.course_id);

  // Count active students in assigned courses
  let studentCount = 0;
  if (courseIds.length > 0) {
    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .in("course_id", courseIds)
      .eq("status", "active");

    studentCount = count || 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Instructor Dashboard</h1>
          <p className="text-sm text-slate-500">
            Manage your teaching materials, student progress, and assignments
          </p>
        </div>
        <Link href="/instructor/courses">
          <Button>My Courses</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Assigned Courses"
          value={courseIds.length}
          description="Courses you teach"
          icon={BookOpen}
        />
        <StatCard
          title="Total Students"
          value={studentCount}
          description="Enrolled across your courses"
          icon={Users}
        />
        <StatCard title="Submissions" value="0" description="Pending review" icon={FileText} />
        <StatCard
          title="Completion Rate"
          value="—"
          description="Across your curriculum"
          icon={CheckCircle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teaching Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {assignedCourses && assignedCourses.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {assignedCourses.map((ac) => {
                const course = Array.isArray(ac.course) ? ac.course[0] : ac.course;
                return (
                  <div key={ac.course_id} className="flex items-center justify-between py-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {course?.title || "Untitled Course"}
                      </h4>
                      <span className="text-xs capitalize text-slate-500">
                        Status: {course?.status || "draft"}
                      </span>
                    </div>
                    <Link href={`/courses/${ac.course_id}`}>
                      <Button size="sm" variant="outline">
                        View Course
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              You are not currently assigned to any courses. An administrator can assign you to
              courses in the Admin Portal.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

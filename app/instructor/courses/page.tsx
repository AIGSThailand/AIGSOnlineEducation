import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { CourseStatus } from "@/types/database.types";

interface AssignedCourseItem {
  course_id: string;
  course: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: CourseStatus;
  } | {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    status: CourseStatus;
  }[] | null;
}

export default async function InstructorCoursesPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("course_instructors")
    .select(`
      course_id,
      course:courses(id, title, slug, description, status)
    `)
    .eq("instructor_id", user?.id || "");

  const assigned = (data as unknown as AssignedCourseItem[] | null) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My Teaching Courses
        </h1>
        <p className="text-sm text-slate-500">
          Courses assigned to you for content management and grading
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {assigned.length > 0 ? (
          assigned.map((item) => {
            const course = Array.isArray(item.course) ? item.course[0] : item.course;
            if (!course) return null;

            return (
              <Card key={course.id} className="flex flex-col justify-between p-6">
                <div>
                  <div className="mb-2">
                    <Badge variant={course.status === "published" ? "success" : "default"}>
                      {course.status}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
                    {course.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                    {course.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                  <Link href={`/courses/${course.id}`} className="w-full">
                    <Button variant="primary" size="sm" className="w-full">
                      View Curriculum
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-slate-500">
            You do not currently have any assigned courses.
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { BuilderPortal, CourseListItem } from "@/features/courses/types";

interface CourseListTableProps {
  courses: CourseListItem[];
  portal: BuilderPortal;
  showInstructorColumn?: boolean;
}

export function CourseListTable({
  courses,
  portal,
  showInstructorColumn = false,
}: CourseListTableProps) {
  if (courses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <h3 className="text-lg font-semibold text-slate-900">No courses yet</h3>
        <p className="mt-2 text-sm text-slate-600">
          Create your first course to start building learning content.
        </p>
        <Link href={`/${portal}/courses/new`} className="mt-6 inline-block">
          <Button>Create Course</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="w-[40%] px-6 py-3">Course</th>
              <th className="w-[10%] whitespace-nowrap px-6 py-3">Status</th>
              {showInstructorColumn && (
                <th className="w-[16%] whitespace-nowrap px-6 py-3">Instructor</th>
              )}
              <th className="w-[10%] whitespace-nowrap px-6 py-3">Students</th>
              <th className="w-[12%] whitespace-nowrap px-6 py-3">Updated</th>
              <th className="w-[12%] whitespace-nowrap px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4">
                  <div className="truncate font-semibold text-slate-900" title={course.title}>
                    {course.title}
                  </div>
                  <div
                    className="truncate font-mono text-xs text-slate-500"
                    title={`/${course.slug}`}
                  >
                    /{course.slug}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={course.status === "published" ? "success" : "default"}>
                    {course.status}
                  </Badge>
                </td>
                {showInstructorColumn && (
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <div
                      className="truncate"
                      title={course.instructorNames.join(", ") || undefined}
                    >
                      {course.instructorNames.join(", ") || "—"}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4">{course.enrollmentCount}</td>
                <td className="px-6 py-4 text-xs text-slate-500">{formatDate(course.updatedAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/${portal}/courses/${course.id}/edit`}>
                      <Button size="sm" variant="ghost">
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/courses/${course.id}/preview`} target="_blank">
                      <Button size="sm" variant="ghost">
                        Preview
                      </Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

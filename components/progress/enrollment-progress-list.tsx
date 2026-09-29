import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { CourseOption, EnrollmentProgressRow } from "@/features/progress/staff-queries";

function progressLabel(row: EnrollmentProgressRow): string {
  if (row.total === 0) return "No steps";
  return `${row.completed}/${row.total} · ${row.percent}%`;
}

export function EnrollmentProgressList({
  title,
  description,
  basePath,
  courses,
  rows,
  selectedCourseId,
  showBilling,
}: {
  title: string;
  description: string;
  basePath: string;
  courses: CourseOption[];
  rows: EnrollmentProgressRow[];
  selectedCourseId: string | null;
  showBilling: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-700">
          Course
          <select
            name="course"
            defaultValue={selectedCourseId || ""}
            className="mt-1 block h-10 min-w-64 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-10 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Filter
        </button>
      </form>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Learners ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Progress</th>
                  <th className="px-6 py-3">Last activity</th>
                  <th className="px-6 py-3">Status</th>
                  {showBilling ? <th className="px-6 py-3">Stripe / WP</th> : null}
                  <th className="px-6 py-3">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.enrollmentId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <Link
                          href={`${basePath}/${row.enrollmentId}`}
                          className="font-semibold text-slate-900 hover:text-brand-700"
                        >
                          {row.studentName}
                        </Link>
                        <div className="text-xs text-slate-500">{row.email}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{row.courseTitle}</td>
                      <td className="px-6 py-4">
                        <Link href={`${basePath}/${row.enrollmentId}`} className="hover:text-brand-700">
                          {progressLabel(row)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {row.lastActivityAt ? formatDateTime(row.lastActivityAt) : "No activity"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={row.status === "active" ? "success" : "default"}>{row.status}</Badge>
                      </td>
                      {showBilling ? (
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {row.stripeSubscriptionId || row.wordpressEnrollmentId || "—"}
                        </td>
                      ) : null}
                      <td className="px-6 py-4 text-xs text-slate-500">{formatDate(row.enrolledAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={showBilling ? 7 : 6} className="px-6 py-8 text-center text-slate-500">
                      No enrollments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface EnrollmentRow {
  id: string;
  status: string;
  enrolled_at: string;
  wordpress_enrollment_id: number | null;
  stripe_subscription_id: string | null;
  student: { email: string; first_name: string | null; last_name: string | null } | null;
  course: { title: string } | null;
}

export default async function AdminEnrollmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrolled_at,
      wordpress_enrollment_id,
      stripe_subscription_id,
      student:profiles!enrollments_student_id_fkey(email, first_name, last_name),
      course:courses!enrollments_course_id_fkey(title)
    `
    )
    .order("enrolled_at", { ascending: false })
    .limit(50);

  const enrollments = (data as unknown as EnrollmentRow[] | null) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Enrollment Records</h1>
        <p className="text-sm text-slate-500">
          Student course registrations, access statuses, and subscription links
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Enrollments ({enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Stripe / WP Reference</th>
                  <th className="px-6 py-3">Enrolled Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.length > 0 ? (
                  enrollments.map((e) => {
                    const student = Array.isArray(e.student) ? e.student[0] : e.student;
                    const course = Array.isArray(e.course) ? e.course[0] : e.course;

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {student?.first_name || ""} {student?.last_name || ""}
                          </div>
                          <div className="text-xs text-slate-500">{student?.email}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {course?.title || "Unknown Course"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={e.status === "active" ? "success" : "default"}>
                            {e.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                          {e.stripe_subscription_id ||
                            (e.wordpress_enrollment_id ? `WP: ${e.wordpress_enrollment_id}` : "—")}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatDate(e.enrolled_at)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No enrollments found.
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

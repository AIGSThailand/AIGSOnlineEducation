import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function InstructorStudentsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  // Fetch instructor course IDs
  const { data: assigned } = await supabase
    .from("course_instructors")
    .select("course_id")
    .eq("instructor_id", user?.id || "");

  const courseIds = assigned?.map((a) => a.course_id) || [];

  let enrollments: any[] = [];
  if (courseIds.length > 0) {
    const { data } = await supabase
      .from("enrollments")
      .select(`
        id,
        status,
        enrolled_at,
        student:profiles!enrollments_student_id_fkey(id, email, first_name, last_name),
        course:courses!enrollments_course_id_fkey(id, title)
      `)
      .in("course_id", courseIds)
      .order("enrolled_at", { ascending: false });

    enrollments = data || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Enrolled Students
        </h1>
        <p className="text-sm text-slate-500">
          Learners actively enrolled in your assigned courses
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100">
          <CardTitle>Enrolled Learners ({enrollments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Enrolled On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrollments.length > 0 ? (
                  enrollments.map((item) => {
                    const student = Array.isArray(item.student) ? item.student[0] : item.student;
                    const course = Array.isArray(item.course) ? item.course[0] : item.course;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {student?.first_name || ""} {student?.last_name || ""}
                          </div>
                          <div className="text-xs text-slate-500">{student?.email}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {course?.title || "Course"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={item.status === "active" ? "success" : "default"}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {formatDate(item.enrolled_at)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No enrolled students found for your courses.
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

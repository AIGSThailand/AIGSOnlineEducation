import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: courseCount },
    { count: enrollmentCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Overview</h1>
        <p className="text-sm text-slate-500">
          System-wide metrics, user administration, and LMS migration status
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Users"
          value={userCount ?? 0}
          description="Registered platform accounts"
          icon={Users}
        />
        <StatCard
          title="Total Courses"
          value={courseCount ?? 0}
          description="Published & draft courses"
          icon={BookOpen}
        />
        <StatCard
          title="Active Enrollments"
          value={enrollmentCount ?? 0}
          description="Students in active courses"
          icon={GraduationCap}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LearnDash Migration Reconciler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Database schema is equipped with legacy columns (`wordpress_user_id`,
              `wordpress_course_id`, `wordpress_lesson_id`).
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700">
              Status: Ready for migration script ingestion
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
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
        <h1 className="text-3xl font-bold tracking-tight">Admin overview</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Users, courses, and enrollments on this environment.
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
    </div>
  );
}

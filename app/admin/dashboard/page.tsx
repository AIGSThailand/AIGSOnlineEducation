import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { countAdminAssignments, countAdminQuizzes } from "@/features/curriculum/admin-index";
import { Users, BookOpen, GraduationCap, FileCheck, HelpCircle } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ count: userCount }, { count: courseCount }, { count: enrollmentCount }, assignmentCount, quizCount] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("courses").select("*", { count: "exact", head: true }),
      supabase.from("enrollments").select("*", { count: "exact", head: true }),
      countAdminAssignments(),
      countAdminQuizzes(),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin overview</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Users, courses, enrollments, assignments, and quizzes on this environment.
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
        <Link href="/admin/assignments" className="block">
          <StatCard
            title="Assignments"
            value={assignmentCount}
            description="Lessons completed by submission"
            icon={FileCheck}
          />
        </Link>
        <Link href="/admin/quizzes" className="block">
          <StatCard
            title="Quizzes"
            value={quizCount}
            description="Quizzes across all courses"
            icon={HelpCircle}
          />
        </Link>
      </div>
    </div>
  );
}

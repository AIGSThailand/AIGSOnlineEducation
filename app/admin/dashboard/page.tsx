import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap, DollarSign } from "lucide-react";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch counts with Supabase Server queries
  const [
    { count: userCount },
    { count: courseCount },
    { count: enrollmentCount },
    { count: subscriptionCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase.from("subscriptions").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Overview</h1>
        <p className="text-sm text-slate-500">
          System-wide metrics, user administration, and LMS migration status
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          title="Stripe Subscriptions"
          value={subscriptionCount ?? 0}
          description="Synced subscription accounts"
          icon={DollarSign}
        />
      </div>

      {/* Migration & System Status */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Stripe Webhook Infrastructure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Server-side webhook endpoint at <code>/api/stripe/webhook</code> listening for
                customer & subscription events.
              </p>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 font-mono text-xs text-emerald-800">
                Endpoint: /api/stripe/webhook (Raw body verification enabled)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

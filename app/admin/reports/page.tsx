import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  getCourseCompletionRates,
  getEnrollmentTrendLast30Days,
  getMigrationReconciliation,
} from "@/features/reports/queries";

export default async function AdminReportsPage() {
  const [trend, completions, reconciliation] = await Promise.all([
    getEnrollmentTrendLast30Days(),
    getCourseCompletionRates(),
    getMigrationReconciliation(),
  ]);

  const trendTotal = trend.reduce((sum, d) => sum + d.count, 0);
  const maxTrend = Math.max(1, ...trend.map((d) => d.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform Reports</h1>
        <p className="text-sm text-slate-500">
          Enrollment trends, course completion, and LearnDash migration reconciliation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment trend (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            Total new enrollments: <span className="font-semibold text-slate-900">{trendTotal}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Day (UTC)</th>
                  <th className="py-2 pr-4 font-medium">Enrollments</th>
                  <th className="py-2 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.day} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs text-slate-700">{row.day}</td>
                    <td className="py-2 pr-4 text-slate-900">{row.count}</td>
                    <td className="py-2">
                      <div className="h-2 max-w-xs rounded bg-slate-100">
                        <div
                          className="h-2 rounded bg-brand-600"
                          style={{ width: `${(row.count / maxTrend) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Completion rate by course</CardTitle>
        </CardHeader>
        <CardContent>
          {completions.length === 0 ? (
            <p className="text-sm text-slate-600">No published courses yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Course</th>
                    <th className="py-2 pr-4 font-medium">Enrollments</th>
                    <th className="py-2 pr-4 font-medium">Completed</th>
                    <th className="py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {completions.map((row) => (
                    <tr key={row.courseId} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-900">{row.title}</td>
                      <td className="py-2 pr-4 text-slate-700">{row.enrollmentCount}</td>
                      <td className="py-2 pr-4 text-slate-700">{row.completedCount}</td>
                      <td className="py-2 font-medium text-slate-900">{row.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Completion uses enrollment status <code className="rounded bg-slate-100 px-1">completed</code>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>LearnDash migration reconciliation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-slate-600">
            Live Supabase counts vs rows recorded in{" "}
            <code className="rounded bg-slate-100 px-1">wordpress_migration_map</code> (no WordPress
            API call).
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Entity</th>
                  <th className="py-2 pr-4 font-medium">Live</th>
                  <th className="py-2 pr-4 font-medium">Mapped</th>
                  <th className="py-2 font-medium">Delta (live − mapped)</th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.map((row) => (
                  <tr key={row.entity} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-900">{row.entity}</td>
                    <td className="py-2 pr-4 text-slate-700">{row.liveCount}</td>
                    <td className="py-2 pr-4 text-slate-700">{row.mappedCount}</td>
                    <td
                      className={`py-2 font-medium ${
                        row.delta === 0 ? "text-slate-900" : "text-amber-700"
                      }`}
                    >
                      {row.delta > 0 ? `+${row.delta}` : row.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

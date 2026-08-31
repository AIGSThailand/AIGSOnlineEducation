import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Reports
        </h1>
        <p className="text-sm text-slate-500">
          Learning analytics, revenue reconciliation, and system diagnostics
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Module (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Advanced reports for student retention, course completion ratios, and LearnDash migration reconciliation metrics will be enabled in the reporting phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

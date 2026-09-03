import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StudentAssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Assignments</h1>
        <p className="text-sm text-slate-500">
          View assigned homework, project milestones, and submission statuses
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Portal (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Student assignment uploads, peer reviews, and automated code evaluation will be enabled
            in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

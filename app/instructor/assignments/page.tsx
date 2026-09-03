import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function InstructorAssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Assignments & Grading</h1>
        <p className="text-sm text-slate-500">Review student submissions and post evaluations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Submissions (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Instructor assignment submission review and grading rubrics will be enabled in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

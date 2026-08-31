import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StudentGradesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Grades & Course Progress
        </h1>
        <p className="text-sm text-slate-500">
          Detailed transcript of completed modules, quizzes, and grade points
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gradebook Engine (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Comprehensive gradebook view and module completion metrics will be available in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

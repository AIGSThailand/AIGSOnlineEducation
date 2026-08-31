import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function InstructorQuizzesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Quiz Assessment Manager
        </h1>
        <p className="text-sm text-slate-500">
          Design quizzes and review question responses
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quiz Engine (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            The interactive quiz builder and automated grading engine will be integrated in Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

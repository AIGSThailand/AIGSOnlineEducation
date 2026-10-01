import { requireAdmin } from "@/features/courses/permissions";
import { listAdminQuizzes } from "@/features/curriculum/admin-index";
import { CurriculumIndexList } from "@/components/admin/curriculum-index-list";

export default async function AdminQuizzesPage() {
  await requireAdmin();
  const rows = await listAdminQuizzes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Every quiz placed in a course. Open one to edit questions in the course builder.
        </p>
      </div>
      <CurriculumIndexList
        title="Quizzes"
        rows={rows}
        empty="No quizzes are in a course yet. Add a quiz from that course’s curriculum."
      />
    </div>
  );
}

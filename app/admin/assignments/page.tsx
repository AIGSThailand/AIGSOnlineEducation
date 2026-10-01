import { requireAdmin } from "@/features/courses/permissions";
import { listAdminAssignments } from "@/features/curriculum/admin-index";
import { CurriculumIndexList } from "@/components/admin/curriculum-index-list";

export default async function AdminAssignmentsPage() {
  await requireAdmin();
  const rows = await listAdminAssignments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Lessons that are complete when the learner submits an assignment. Open one to edit it in
          the course builder.
        </p>
      </div>
      <CurriculumIndexList
        title="Assignments"
        rows={rows}
        empty="No lessons use assignment submission yet. In a lesson’s learning settings, set completion to Assignment submit."
      />
    </div>
  );
}

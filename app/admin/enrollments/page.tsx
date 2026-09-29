import { EnrollmentProgressList } from "@/components/progress/enrollment-progress-list";
import { listEnrollmentProgress } from "@/features/progress/staff-queries";

export default async function AdminEnrollmentsPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const progress = await listEnrollmentProgress(searchParams?.course);

  return (
    <EnrollmentProgressList
      title="Enrollment Records"
      description="Learner progress for every course. Open a learner to see each lesson and quiz. This list is read-only."
      basePath="/admin/enrollments"
      courses={progress.courses}
      rows={progress.rows}
      selectedCourseId={progress.selectedCourseId}
      showBilling={true}
    />
  );
}

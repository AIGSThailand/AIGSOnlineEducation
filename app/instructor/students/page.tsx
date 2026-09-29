import { EnrollmentProgressList } from "@/components/progress/enrollment-progress-list";
import { listEnrollmentProgress } from "@/features/progress/staff-queries";

export default async function InstructorStudentsPage({
  searchParams,
}: {
  searchParams?: { course?: string };
}) {
  const progress = await listEnrollmentProgress(searchParams?.course);

  return (
    <EnrollmentProgressList
      title="Enrolled Students"
      description="Progress for learners in your courses. Open a learner to see each lesson and quiz. This list is read-only."
      basePath="/instructor/students"
      courses={progress.courses}
      rows={progress.rows}
      selectedCourseId={progress.selectedCourseId}
      showBilling={false}
    />
  );
}

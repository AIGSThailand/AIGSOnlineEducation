import { notFound } from "next/navigation";
import { EnrollmentProgressDetailView } from "@/components/progress/enrollment-progress-detail";
import { getEnrollmentProgress } from "@/features/progress/staff-queries";

export default async function AdminEnrollmentProgressPage({
  params,
}: {
  params: { enrollmentId: string };
}) {
  const detail = await getEnrollmentProgress(params.enrollmentId);
  if (!detail) notFound();

  return (
    <EnrollmentProgressDetailView
      detail={detail}
      backHref="/admin/enrollments"
      backLabel="Enrollments"
    />
  );
}

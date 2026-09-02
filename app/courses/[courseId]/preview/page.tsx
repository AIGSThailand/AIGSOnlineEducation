import { notFound, redirect } from "next/navigation";
import { canManageCourse } from "@/features/courses/permissions";

interface CoursePreviewPageProps {
  params: { courseId: string };
}

/**
 * Authorized draft preview — only admins and assigned instructors may access.
 * Redirects to the student-facing course page (RLS allows draft read for authorized users).
 */
export default async function CoursePreviewPage({ params }: CoursePreviewPageProps) {
  const allowed = await canManageCourse(params.courseId);

  if (!allowed) {
    notFound();
  }

  redirect(`/courses/${params.courseId}?preview=1`);
}

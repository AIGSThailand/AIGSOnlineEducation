import { notFound, redirect } from "next/navigation";
import { canManageCourse } from "@/features/courses/permissions";
import CourseDetailPage from "@/components/courses/course-detail-page";

interface CoursePreviewPageProps {
  params: { courseId: string };
  searchParams?: { audience?: string };
}

/**
 * Authorized draft preview — only admins and assigned instructors may access.
 * Redirects to the student-facing course page (RLS allows draft read for authorized users).
 */
export default async function CoursePreviewPage({ params, searchParams }: CoursePreviewPageProps) {
  const allowed = await canManageCourse(params.courseId);

  if (!allowed) {
    notFound();
  }

  if (searchParams?.audience === "visitor") return <CourseDetailPage params={params} audience="visitor" />;
  redirect(`/courses/${params.courseId}?preview=1`);
}

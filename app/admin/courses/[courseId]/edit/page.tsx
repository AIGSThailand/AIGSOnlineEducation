import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { getCourseBuilderData } from "@/features/courses/queries";
import { CourseBuilder } from "@/components/courses/builder/course-builder";

interface EditCoursePageProps {
  params: { courseId: string };
}

export default async function AdminEditCoursePage({ params }: EditCoursePageProps) {
  await requireCourseBuilderAccess("admin");
  const data = await getCourseBuilderData(params.courseId);

  if (!data) notFound();

  return <CourseBuilder portal="admin" data={data} isAdmin />;
}

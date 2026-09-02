import Link from "next/link";
import { notFound } from "next/navigation";
import {
  requireCourseBuilderAccess,
  requireCourseManage,
} from "@/features/courses/permissions";
import { getCourseBuilderData } from "@/features/courses/queries";
import { CourseBuilder } from "@/components/courses/builder/course-builder";

interface EditCoursePageProps {
  params: { courseId: string };
}

export default async function InstructorEditCoursePage({ params }: EditCoursePageProps) {
  const user = await requireCourseBuilderAccess("instructor");
  await requireCourseManage(params.courseId);
  const data = await getCourseBuilderData(params.courseId);

  if (!data) notFound();

  const isAdmin = user.profile?.role === "admin";

  return <CourseBuilder portal="instructor" data={data} isAdmin={isAdmin} />;
}

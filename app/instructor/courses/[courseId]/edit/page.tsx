import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCourseBuilderAccess, requireCourseManage } from "@/features/courses/permissions";
import { getCourseBuilderData } from "@/features/courses/queries";
import { parseBuilderSelectionFromSearchParams } from "@/features/courses/types";
import { CourseBuilder } from "@/components/courses/builder/course-builder";

interface EditCoursePageProps {
  params: { courseId: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function InstructorEditCoursePage({
  params,
  searchParams,
}: EditCoursePageProps) {
  const user = await requireCourseBuilderAccess("instructor");
  await requireCourseManage(params.courseId);
  const isAdmin = user.profile?.role === "admin";
  const data = await getCourseBuilderData(params.courseId, { isAdmin });

  if (!data) notFound();

  const initialSelection = parseBuilderSelectionFromSearchParams(searchParams);

  return (
    <CourseBuilder
      portal="instructor"
      data={data}
      isAdmin={isAdmin}
      initialSelection={initialSelection}
    />
  );
}

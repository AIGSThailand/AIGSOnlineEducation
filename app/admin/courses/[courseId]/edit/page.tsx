import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { getCourseBuilderData } from "@/features/courses/queries";
import { parseBuilderSelectionFromSearchParams } from "@/features/courses/types";
import { CourseBuilder } from "@/components/courses/builder/course-builder";

interface EditCoursePageProps {
  params: { courseId: string };
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function AdminEditCoursePage({
  params,
  searchParams,
}: EditCoursePageProps) {
  await requireCourseBuilderAccess("admin");
  const data = await getCourseBuilderData(params.courseId, { isAdmin: true });

  if (!data) notFound();

  const initialSelection = parseBuilderSelectionFromSearchParams(searchParams);

  return (
    <CourseBuilder
      portal="admin"
      data={data}
      isAdmin
      initialSelection={initialSelection}
    />
  );
}

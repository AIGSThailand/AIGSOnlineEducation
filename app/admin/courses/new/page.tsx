import Link from "next/link";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { getInstructorOptions } from "@/features/courses/queries";
import { NewCourseForm } from "@/components/courses/builder/new-course-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function AdminNewCoursePage() {
  await requireCourseBuilderAccess("admin");
  const instructors = await getInstructorOptions();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/courses">
          <Button variant="ghost" size="sm" className="-ml-2 mb-4">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to courses
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create new course</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter basic information to create a draft. You will be redirected to the Course Builder.
        </p>
      </div>
      <NewCourseForm portal="admin" instructors={instructors} isAdmin />
    </div>
  );
}

import Link from "next/link";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { NewCourseForm } from "@/components/courses/builder/new-course-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function InstructorNewCoursePage() {
  const user = await requireCourseBuilderAccess("instructor");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/instructor/courses">
          <Button variant="ghost" size="sm" className="-ml-2 mb-4">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to courses
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create new course</h1>
        <p className="mt-1 text-sm text-slate-500">
          A draft course will be created and you will be assigned as the instructor.
        </p>
      </div>
      <NewCourseForm
        portal="instructor"
        instructors={[]}
        isAdmin={false}
        defaultInstructorId={user.id}
      />
    </div>
  );
}

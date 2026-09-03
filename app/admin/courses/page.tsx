import Link from "next/link";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { getCourseListForAdmin, getInstructorOptions } from "@/features/courses/queries";
import { CourseListTable } from "@/components/courses/builder/course-list-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface AdminCoursesPageProps {
  searchParams: {
    q?: string;
    status?: string;
    instructor?: string;
  };
}

export default async function AdminCoursesPage({ searchParams }: AdminCoursesPageProps) {
  await requireCourseBuilderAccess("admin");

  const status =
    searchParams.status === "draft" ||
    searchParams.status === "published" ||
    searchParams.status === "archived"
      ? searchParams.status
      : "all";

  const [courses, instructors] = await Promise.all([
    getCourseListForAdmin({
      search: searchParams.q,
      status,
      instructorId: searchParams.instructor,
    }),
    getInstructorOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Course Administration
          </h1>
          <p className="text-sm text-slate-500">
            Create, publish, and manage all courses across the platform
          </p>
        </div>
        <Link href="/admin/courses/new">
          <Button>+ New Course</Button>
        </Link>
      </div>

      <form className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            name="q"
            defaultValue={searchParams.q || ""}
            placeholder="Course title…"
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="instructor">Instructor</Label>
          <Select id="instructor" name="instructor" defaultValue={searchParams.instructor || ""}>
            <option value="">All instructors</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {`${inst.firstName || ""} ${inst.lastName || ""}`.trim() || inst.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Apply filters
          </Button>
        </div>
      </form>

      <CourseListTable courses={courses} portal="admin" showInstructorColumn />
    </div>
  );
}

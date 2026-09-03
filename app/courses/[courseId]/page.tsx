import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canAccessCourse, getCurrentUser } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCourseSyllabus } from "@/features/courses/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BuyCourseButton } from "@/components/stripe/buy-course-button";
import { RichContent } from "@/components/courses/rich-content";
import { BookOpen, CheckCircle, Clock, PlayCircle } from "lucide-react";
import type { Database } from "@/types/database.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

interface CourseDetailPageProps {
  params: {
    courseId: string;
  };
  searchParams?: {
    preview?: string;
  };
}

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { courseId } = params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();

  if (!course) {
    notFound();
  }

  const syllabus = await getCourseSyllabus(courseId);
  const { modules, lessonCount, firstLessonId } = syllabus;

  let isEnrolled = false;
  if (user) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("status")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .maybeSingle<{ status: string }>();

    isEnrolled = !!enrollment;
  }

  const canManage = await canManageCourse(courseId);
  const isPreview = searchParams?.preview === "1" && canManage;
  // Admins / assigned instructors / group members unlock via canAccessCourse —
  // enrollment is only required for regular students.
  const hasContentAccess = isEnrolled || (await canAccessCourse(courseId)) || isPreview;
  const role = user?.profile?.role;
  const accessAsStaff = hasContentAccess && !isEnrolled && (role === "admin" || canManage);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {isPreview && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Preview mode — you are viewing this course as an authorized builder. Draft content is
          visible only to you.
        </div>
      )}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <div>
            <div className="mb-3 flex items-center space-x-2">
              <Badge variant={course.status === "published" ? "success" : "default"}>
                {course.status}
              </Badge>
              {isEnrolled && <Badge variant="default">Active Enrollment</Badge>}
              {accessAsStaff && <Badge variant="warning">Staff access</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {course.title}
            </h1>
            <RichContent
              html={course.description}
              className="mt-4 text-base"
              fallback="No description provided."
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Curriculum Syllabus</h2>
            {modules.length > 0 ? (
              <div className="space-y-3">
                {modules.map((module, mIdx) => (
                  <Card key={module.id} className="p-4">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">
                      Section {mIdx + 1}: {module.title}
                    </h3>
                    <div className="space-y-2">
                      {module.lessons.length === 0 ? (
                        <p className="text-xs text-slate-400">No lessons in this section yet.</p>
                      ) : (
                        module.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between py-1.5 text-sm text-slate-700"
                          >
                            <div className="flex items-center space-x-2">
                              <PlayCircle className="h-4 w-4 text-slate-400" />
                              <span>{lesson.title}</span>
                            </div>
                            {hasContentAccess ? (
                              <Link
                                href={`/courses/${courseId}/lessons/${lesson.id}`}
                                className="text-xs font-semibold text-brand-600 hover:text-brand-500"
                              >
                                Start →
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-400">Locked</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Curriculum modules are being scheduled.</p>
            )}
          </div>
        </div>

        <div>
          <Card className="sticky top-24 p-6">
            {course.thumbnail_url && (
              <div className="mb-4 aspect-video overflow-hidden rounded-md bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <BookOpen className="mr-2 h-4 w-4 text-slate-400" /> Modules
                  </span>
                  <span className="font-semibold text-slate-900">{modules.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-slate-400" /> Total Lessons
                  </span>
                  <span className="font-semibold text-slate-900">{lessonCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-slate-400" /> Access
                  </span>
                  <span className="font-semibold text-slate-900">
                    {hasContentAccess ? (isEnrolled ? "Enrolled" : "Staff") : "Locked"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                {hasContentAccess && firstLessonId ? (
                  <Link href={`/courses/${courseId}/lessons/${firstLessonId}`} className="block">
                    <Button className="w-full" size="lg">
                      {isEnrolled ? "Go to First Lesson" : "Open as staff"}
                    </Button>
                  </Link>
                ) : hasContentAccess && canManage ? (
                  <Link href={`/admin/courses/${courseId}/edit`} className="block">
                    <Button className="w-full" size="lg" variant="outline">
                      Open course builder
                    </Button>
                  </Link>
                ) : user ? (
                  <BuyCourseButton
                    courseId={course.id}
                    courseTitle={course.title}
                    amount={99}
                    label="Enroll Now (One-Time)"
                  />
                ) : (
                  <Link href={`/login?redirect=/courses/${courseId}`} className="block">
                    <Button className="w-full" size="lg">
                      Sign In to Enroll
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

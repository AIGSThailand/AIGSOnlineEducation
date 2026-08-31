import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle, Clock, PlayCircle } from "lucide-react";
import type { ModuleWithLessons } from "@/types/lms.types";

interface CourseDetailPageProps {
  params: {
    courseId: string;
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { courseId } = params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Fetch course details
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    notFound();
  }

  // Fetch modules and lessons
  const { data: modulesData } = await supabase
    .from("modules")
    .select(`
      id,
      course_id,
      title,
      sort_order,
      lessons (
        id,
        module_id,
        course_id,
        title,
        slug,
        sort_order
      )
    `)
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  // Format modules and sorted lessons
  const modules: ModuleWithLessons[] = (modulesData || []).map((m) => ({
    id: m.id,
    course_id: m.course_id,
    title: m.title,
    sort_order: m.sort_order,
    lessons: (m.lessons || []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Check enrollment
  let isEnrolled = false;
  if (user) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("status")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    isEnrolled = !!enrollment;
  }

  const firstLesson = modules[0]?.lessons[0];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Left 2 Cols: Course Overview & Syllabus */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="mb-3 flex items-center space-x-2">
              <Badge variant={course.status === "published" ? "success" : "default"}>
                {course.status}
              </Badge>
              {isEnrolled && <Badge variant="default">Active Enrollment</Badge>}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              {course.title}
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              {course.description || "No description provided."}
            </p>
          </div>

          {/* Syllabus Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Curriculum Syllabus</h2>
            {modules.length > 0 ? (
              <div className="space-y-3">
                {modules.map((module, mIdx) => (
                  <Card key={module.id} className="p-4">
                    <h3 className="text-sm font-bold text-slate-900 mb-3">
                      Section {mIdx + 1}: {module.title}
                    </h3>
                    <div className="space-y-2">
                      {module.lessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between py-1.5 text-sm text-slate-700"
                        >
                          <div className="flex items-center space-x-2">
                            <PlayCircle className="h-4 w-4 text-slate-400" />
                            <span>{lesson.title}</span>
                          </div>
                          {isEnrolled ? (
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
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Curriculum modules are being scheduled.</p>
            )}
          </div>
        </div>

        {/* Right 1 Col: Course Action Card */}
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
                  <span className="font-semibold text-slate-900">
                    {modules.reduce((acc, m) => acc + m.lessons.length, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-slate-400" /> Access
                  </span>
                  <span className="font-semibold text-slate-900">Lifetime</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                {isEnrolled && firstLesson ? (
                  <Link href={`/courses/${courseId}/lessons/${firstLesson.id}`} className="block">
                    <Button className="w-full" size="lg">
                      Go to First Lesson
                    </Button>
                  </Link>
                ) : user ? (
                  <Button className="w-full" size="lg" disabled>
                    Subscription Required
                  </Button>
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

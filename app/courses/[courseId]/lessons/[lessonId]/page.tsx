import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, canAccessCourse } from "@/lib/auth/permissions";
import { LessonSidebar } from "@/components/courses/lesson-sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ModuleWithLessons } from "@/types/lms.types";

interface LessonPageProps {
  params: {
    courseId: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = params;
  const user = await requireAuth();

  // Authorize user access to this course
  const hasAccess = await canAccessCourse(courseId);
  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            You must be enrolled in this course with an active subscription to access its lessons.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  // Fetch lesson details
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!lesson) {
    notFound();
  }

  // Fetch modules & lessons for sidebar navigation
  const { data: rawModules } = await supabase
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

  interface RawModuleItem {
    id: string;
    course_id: string;
    title: string;
    sort_order: number;
    lessons: {
      id: string;
      module_id: string | null;
      course_id: string;
      title: string;
      slug: string;
      sort_order: number;
    }[];
  }

  const modulesData = (rawModules as unknown as RawModuleItem[] | null) || [];

  const modules: ModuleWithLessons[] = modulesData.map((m) => ({
    id: m.id,
    course_id: m.course_id,
    title: m.title,
    sort_order: m.sort_order,
    lessons: (m.lessons || []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  // Fetch student completed lessons
  const { data: progressList } = await supabase
    .from("lesson_progress")
    .select("lesson_id")
    .eq("student_id", user.id)
    .eq("course_id", courseId)
    .eq("completed", true);

  const completedLessonIds = progressList?.map((p) => p.lesson_id) || [];

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      {/* Lesson Syllabus Sidebar */}
      <LessonSidebar
        courseId={courseId}
        modules={modules}
        currentLessonId={lessonId}
        completedLessonIds={completedLessonIds}
      />

      {/* Main Lesson Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {lesson.title}
            </h1>
          </div>

          {/* Video Player */}
          {lesson.video_url && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black shadow-md">
              <iframe
                src={lesson.video_url}
                title={lesson.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Lesson Content Body */}
          <div className="prose max-w-none text-slate-700">
            {lesson.content ? (
              <div className="whitespace-pre-line leading-relaxed">
                {lesson.content}
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">
                No supplementary textual notes provided for this lesson.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

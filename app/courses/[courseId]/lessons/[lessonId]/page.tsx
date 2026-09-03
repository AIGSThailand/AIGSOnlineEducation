import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, canAccessCourse } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";
import { CoursePlayer } from "@/components/player/course-player";
import { RichContent } from "@/components/courses/rich-content";
import { Card } from "@/components/ui/card";
import type { Database } from "@/types/database.types";

type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

interface LessonPageProps {
  params: {
    courseId: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = params;
  const user = await requireAuth();

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

  const player = await getCoursePlayerData(courseId, user.id);
  if (!player) notFound();

  const current = findStepByContent(player.flatSteps, "lesson", lessonId);
  if (!current) notFound();

  const bypass = await canManageCourse(courseId);
  const lockedKeys = lockedStepKeys(
    player.flatSteps,
    new Set(player.completedKeys),
    player.progressionType === "linear",
    bypass
  );
  const isLocked = lockedKeys.has(current.key);

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle<LessonRow>();

  if (!lesson) notFound();

  return (
    <CoursePlayer
      player={player}
      current={current}
      lockedKeys={Array.from(lockedKeys)}
      canToggleComplete={!isLocked}
    >
      {isLocked ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Complete the previous steps to unlock this lesson.
        </p>
      ) : (
        <>
          {lesson.video_url && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={lesson.video_url}
                title={lesson.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          <RichContent
            html={lesson.content}
            fallback="No supplementary textual notes provided for this lesson."
          />
        </>
      )}
    </CoursePlayer>
  );
}

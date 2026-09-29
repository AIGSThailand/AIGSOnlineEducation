import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, canAccessCourse } from "@/lib/auth/permissions";
import { getPublicLessonPreview } from "@/features/lessons/preview";
import { LessonPreview } from "@/components/player/lesson-preview";
import Link from "next/link";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";
import { CoursePlayer } from "@/components/player/course-player";
import { LessonWorkspace } from "@/components/player/lesson-workspace";
import { Card } from "@/components/ui/card";
import type { Database } from "@/types/database.types";

type LessonRow = Database["public"]["Tables"]["lessons"]["Row"] & {
  video_thumbnail_url?: string | null;
  video_transcript?: string | null;
  video_captions_url?: string | null;
};

interface LessonPageProps {
  searchParams?: { audience?: string };
  params: {
    courseId: string;
    lessonId: string;
  };
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const { courseId, lessonId } = params;
  const user = await getCurrentUser();
  const visitorReview = searchParams?.audience === "visitor" && (await canManageCourse(courseId));

  const hasAccess = await canAccessCourse(courseId);
  if (!hasAccess || !user || visitorReview) {
    const preview = await getPublicLessonPreview(courseId, lessonId);
    if (preview) return <LessonPreview courseId={courseId} preview={preview} visitorReview={visitorReview} />;
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            You must be enrolled in this course with an active subscription to access its lessons.
          </p>
          <Link href={`/courses/${courseId}`} className="mt-4 inline-block font-semibold text-brand-700">
            View course and enrollment options
          </Link>
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

  const { data: resourceRows } = isLocked
    ? { data: null }
    : await supabase
        .from("lesson_resources")
        .select("id, resource_type, title, url, is_downloadable, position")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true })
        .returns<
          Array<{
            id: string;
            resource_type: string;
            title: string;
            url: string | null;
            is_downloadable: boolean;
            position: number;
          }>
        >();

  const resources = (resourceRows || []).map((r) => ({
    id: r.id,
    resourceType: r.resource_type,
    title: r.title,
    url: r.url,
    isDownloadable: r.is_downloadable,
  }));

  const transcript = lesson.video_transcript ?? null;

  return (
    <CoursePlayer
      player={player}
      current={current}
      lockedKeys={Array.from(lockedKeys)}
      canToggleComplete={!isLocked}
      transcript={isLocked ? null : transcript}
      resources={isLocked ? [] : resources}
    >
      {isLocked ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Complete the previous steps to unlock this lesson.
        </p>
      ) : (
        <LessonWorkspace
          media={{
            videoUrl: lesson.video_url,
            title: lesson.title,
            posterUrl: lesson.video_thumbnail_url,
            captionsUrl: lesson.video_captions_url,
            transcript,
          }}
          contentHtml={lesson.content}
          resources={resources}
        />
      )}
    </CoursePlayer>
  );
}

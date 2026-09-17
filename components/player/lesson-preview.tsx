import { getCourseSyllabus } from "@/features/courses/queries";
import { getPublicPreviewIds, type PublicLessonPreview } from "@/features/lessons/preview";
import { previewContentHtml, previewMediaUrl } from "@/features/lessons/preview-media";
import { buildPlayerFromModules } from "@/features/player/build-player";
import { createClient } from "@/lib/supabase/server";
import { CoursePlayer } from "./course-player";
import { LessonVideo } from "@/components/courses/lesson-video";
import { RichContent } from "@/components/courses/rich-content";
import { notFound } from "next/navigation";
import { createAnonymousClient } from "@/lib/supabase/anonymous";

export async function LessonPreview({
  courseId,
  preview,
  visitorReview = false,
}: {
  courseId: string;
  preview: PublicLessonPreview;
  visitorReview?: boolean;
}) {
  const anonymous = createAnonymousClient();
  const [syllabus, previewIds, db] = await Promise.all([
    getCourseSyllabus(courseId, anonymous),
    getPublicPreviewIds(courseId, anonymous),
    createClient(),
  ]);
  const { data: course } = await db
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle<{ title: string }>();
  const built = buildPlayerFromModules(
    courseId,
    syllabus.modules,
    syllabus.modules.flatMap((module) => module.lessons)
  );
  if (visitorReview) {
    built.flatSteps.forEach((step) => { step.href += "?audience=visitor"; });
    built.sections.forEach((section) => section.items.forEach((item) => { item.href += "?audience=visitor"; }));
  }
  const current = built.flatSteps.find((step) => step.contentId === preview.id);
  if (!current) notFound();
  const player = {
    ...built,
    courseId,
    courseTitle: course?.title || "Course",
    progressionType: "free_form" as const,
    completedKeys: [],
  };
  const lockedKeys = built.flatSteps
    .filter((step) => !previewIds.includes(step.contentId))
    .map((step) => step.key);
  return (
    <CoursePlayer
      player={player}
      current={current}
      lockedKeys={lockedKeys}
      canToggleComplete={false}
      previewMode
    >
      {preview.video_url && (
        <LessonVideo
          url={previewMediaUrl(preview.video_url, courseId, preview.id)}
          title={preview.title}
          captionsUrl={
            preview.video_captions_url
              ? previewMediaUrl(preview.video_captions_url, courseId, preview.id)
              : undefined
          }
        />
      )}
      <RichContent
        html={previewContentHtml(preview.content, courseId, preview.id)}
        fallback="No supplementary notes for this lesson."
      />
    </CoursePlayer>
  );
}

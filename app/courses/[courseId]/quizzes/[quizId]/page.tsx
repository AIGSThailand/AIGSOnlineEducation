import { notFound } from "next/navigation";
import { requireAuth, canAccessCourse } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";
import { CoursePlayer } from "@/components/player/course-player";
import { QuizPlayer } from "@/components/player/quiz-player";
import { getQuizForPlay } from "@/features/quizzes/player-actions";
import { Card } from "@/components/ui/card";

interface QuizPageProps {
  params: {
    courseId: string;
    quizId: string;
  };
  searchParams?: {
    step?: string;
  };
}

export default async function CourseQuizPage({ params, searchParams }: QuizPageProps) {
  const { courseId, quizId } = params;
  const user = await requireAuth();

  const hasAccess = await canAccessCourse(courseId);
  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            You must be enrolled in this course with an active subscription to access its quizzes.
          </p>
        </Card>
      </div>
    );
  }

  const player = await getCoursePlayerData(courseId, user.id);
  if (!player) notFound();

  const current = searchParams?.step
    ? player.flatSteps.find((s) => s.stepId === searchParams.step && s.kind === "quiz")
    : findStepByContent(player.flatSteps, "quiz", quizId);
  if (!current || current.contentId !== quizId) notFound();

  const bypass = await canManageCourse(courseId);
  const lockedKeys = lockedStepKeys(
    player.flatSteps,
    new Set(player.completedKeys),
    player.progressionType === "linear",
    bypass
  );
  const isLocked = lockedKeys.has(current.key);

  const quizResult = isLocked ? null : await getQuizForPlay(courseId, quizId);

  return (
    <CoursePlayer
      player={player}
      current={current}
      lockedKeys={Array.from(lockedKeys)}
      canToggleComplete={!isLocked}
    >
      {isLocked ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Complete the previous steps to unlock this quiz.
        </p>
      ) : !quizResult?.success || !quizResult.data ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {quizResult && !quizResult.success
            ? quizResult.error
            : "Unable to load this quiz."}
        </p>
      ) : (
        <QuizPlayer
          courseId={courseId}
          quizId={quizId}
          stepId={current.stepId}
          initial={quizResult.data}
        />
      )}
    </CoursePlayer>
  );
}

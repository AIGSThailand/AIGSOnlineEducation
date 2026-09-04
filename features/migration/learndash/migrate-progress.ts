import { createAdminClient } from "@/lib/supabase/admin";
import { assertLearndashMigrationWriteAllowed } from "./env-safety";
import { inspectLearnDashProgress } from "./inspect-progress";
import type {
  ProposedCourseProgress,
  ProposedProgressBatch,
  ProposedProgressStep,
} from "./transform-progress";
import { formatProgressReport } from "./transform-progress";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";

export type MigrateProgressOptions = {
  courseId?: LearnDashEntityId;
  allCourses?: boolean;
  dryRun: boolean;
  allowProductionWrite: boolean;
};

export type MigrateProgressWriteStats = {
  lessonProgressUpserted: number;
  topicProgressUpserted: number;
  stepProgressUpserted: number;
  enrollmentsMarkedComplete: number;
  skippedNoProfile: number;
  skippedNoCourse: number;
  skippedNoLesson: number;
  skippedNoTopic: number;
  skippedNoQuiz: number;
  skippedNoStep: number;
  skippedIncomplete: number;
  failed: number;
  errors: string[];
};

export type MigrateProgressResult = {
  dryRun: boolean;
  proposed: ProposedProgressBatch;
  report: string;
  written?: MigrateProgressWriteStats;
};

type AdminClient = ReturnType<typeof createAdminClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromTable(admin: AdminClient, table: string): any {
  return (admin as any).from(table);
}

async function resolveProfileId(
  admin: AdminClient,
  cache: Map<number, string | null>,
  wordpressUserId: number
): Promise<string | null> {
  if (cache.has(wordpressUserId)) return cache.get(wordpressUserId)!;
  const { data, error } = await fromTable(admin, "profiles")
    .select("id")
    .eq("wordpress_user_id", wordpressUserId)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup: ${error.message}`);
  const id = (data?.id as string) ?? null;
  cache.set(wordpressUserId, id);
  return id;
}

async function resolveCourseId(
  admin: AdminClient,
  cache: Map<number, string | null>,
  wordpressCourseId: number
): Promise<string | null> {
  if (cache.has(wordpressCourseId)) return cache.get(wordpressCourseId)!;
  const { data, error } = await fromTable(admin, "courses")
    .select("id")
    .eq("wordpress_course_id", wordpressCourseId)
    .maybeSingle();
  if (error) throw new Error(`courses lookup: ${error.message}`);
  const id = (data?.id as string) ?? null;
  cache.set(wordpressCourseId, id);
  return id;
}

async function resolveLessonId(
  admin: AdminClient,
  cache: Map<number, string | null>,
  wordpressLessonId: number
): Promise<string | null> {
  if (cache.has(wordpressLessonId)) return cache.get(wordpressLessonId)!;
  const { data, error } = await fromTable(admin, "lessons")
    .select("id")
    .eq("wordpress_lesson_id", wordpressLessonId)
    .maybeSingle();
  if (error) throw new Error(`lessons lookup: ${error.message}`);
  const id = (data?.id as string) ?? null;
  cache.set(wordpressLessonId, id);
  return id;
}

async function resolveTopicId(
  admin: AdminClient,
  cache: Map<number, string | null>,
  wordpressTopicId: number
): Promise<string | null> {
  if (cache.has(wordpressTopicId)) return cache.get(wordpressTopicId)!;
  const { data, error } = await fromTable(admin, "topics")
    .select("id")
    .eq("wordpress_topic_id", wordpressTopicId)
    .maybeSingle();
  if (error) throw new Error(`topics lookup: ${error.message}`);
  let id = (data?.id as string) ?? null;
  if (!id) {
    const mapped = await fromTable(admin, "wordpress_migration_map")
      .select("target_id")
      .eq("source_type", "sfwd-topic")
      .eq("wordpress_id", wordpressTopicId)
      .maybeSingle();
    id = mapped.data?.target_id ?? null;
  }
  cache.set(wordpressTopicId, id);
  return id;
}

async function resolveQuizId(
  admin: AdminClient,
  cache: Map<number, string | null>,
  wordpressQuizId: number
): Promise<string | null> {
  if (cache.has(wordpressQuizId)) return cache.get(wordpressQuizId)!;
  const { data, error } = await fromTable(admin, "quizzes")
    .select("id")
    .eq("wordpress_quiz_id", wordpressQuizId)
    .maybeSingle();
  if (error) throw new Error(`quizzes lookup: ${error.message}`);
  const id = (data?.id as string) ?? null;
  cache.set(wordpressQuizId, id);
  return id;
}

async function findLessonStep(
  admin: AdminClient,
  courseUuid: string,
  lessonUuid: string
): Promise<string | null> {
  const { data, error } = await fromTable(admin, "course_steps")
    .select("id")
    .eq("course_id", courseUuid)
    .eq("lesson_id", lessonUuid)
    .eq("step_type", "lesson")
    .maybeSingle();
  if (error) throw new Error(`course_steps lesson lookup: ${error.message}`);
  return data?.id ?? null;
}

async function findTopicStep(
  admin: AdminClient,
  courseUuid: string,
  topicUuid: string
): Promise<string | null> {
  const { data, error } = await fromTable(admin, "course_steps")
    .select("id")
    .eq("course_id", courseUuid)
    .eq("topic_id", topicUuid)
    .eq("step_type", "topic")
    .maybeSingle();
  if (error) throw new Error(`course_steps topic lookup: ${error.message}`);
  return data?.id ?? null;
}

async function findQuizStep(
  admin: AdminClient,
  courseUuid: string,
  quizUuid: string
): Promise<string | null> {
  const { data, error } = await fromTable(admin, "course_steps")
    .select("id")
    .eq("course_id", courseUuid)
    .eq("quiz_id", quizUuid)
    .eq("step_type", "quiz")
    .maybeSingle();
  if (error) throw new Error(`course_steps quiz lookup: ${error.message}`);
  return data?.id ?? null;
}

async function upsertStepProgress(
  admin: AdminClient,
  studentId: string,
  courseUuid: string,
  courseStepId: string,
  completedAt: string | null,
  stats: MigrateProgressWriteStats
): Promise<void> {
  const { error } = await fromTable(admin, "step_progress").upsert(
    {
      student_id: studentId,
      course_id: courseUuid,
      course_step_id: courseStepId,
      completed: true,
      completed_at: completedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,course_step_id" }
  );
  if (error) {
    stats.failed += 1;
    stats.errors.push(`step_progress ${courseStepId}: ${error.message}`);
    return;
  }
  stats.stepProgressUpserted += 1;
}

async function writeCompletedStep(
  admin: AdminClient,
  step: ProposedProgressStep,
  studentId: string,
  courseUuid: string,
  caches: {
    lessons: Map<number, string | null>;
    topics: Map<number, string | null>;
    quizzes: Map<number, string | null>;
  },
  stats: MigrateProgressWriteStats
): Promise<void> {
  if (!step.completed) {
    stats.skippedIncomplete += 1;
    return;
  }

  if (step.kind === "lesson") {
    const lessonId = await resolveLessonId(admin, caches.lessons, step.wordpressStepId);
    if (!lessonId) {
      stats.skippedNoLesson += 1;
      return;
    }
    const { error } = await fromTable(admin, "lesson_progress").upsert(
      {
        student_id: studentId,
        course_id: courseUuid,
        lesson_id: lessonId,
        completed: true,
        completed_at: step.completedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" }
    );
    if (error) {
      stats.failed += 1;
      stats.errors.push(`lesson_progress wp ${step.wordpressStepId}: ${error.message}`);
      return;
    }
    stats.lessonProgressUpserted += 1;
    const stepId = await findLessonStep(admin, courseUuid, lessonId);
    if (!stepId) {
      stats.skippedNoStep += 1;
      return;
    }
    await upsertStepProgress(admin, studentId, courseUuid, stepId, step.completedAt, stats);
    return;
  }

  if (step.kind === "topic") {
    const topicId = await resolveTopicId(admin, caches.topics, step.wordpressStepId);
    if (!topicId) {
      stats.skippedNoTopic += 1;
      return;
    }
    const { error } = await fromTable(admin, "topic_progress").upsert(
      {
        student_id: studentId,
        course_id: courseUuid,
        topic_id: topicId,
        completed: true,
        completed_at: step.completedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,course_id,topic_id" }
    );
    if (error) {
      stats.failed += 1;
      stats.errors.push(`topic_progress wp ${step.wordpressStepId}: ${error.message}`);
      return;
    }
    stats.topicProgressUpserted += 1;
    const stepId = await findTopicStep(admin, courseUuid, topicId);
    if (!stepId) {
      stats.skippedNoStep += 1;
      return;
    }
    await upsertStepProgress(admin, studentId, courseUuid, stepId, step.completedAt, stats);
    return;
  }

  if (step.kind === "quiz") {
    const quizId = await resolveQuizId(admin, caches.quizzes, step.wordpressStepId);
    if (!quizId) {
      stats.skippedNoQuiz += 1;
      return;
    }
    const stepId = await findQuizStep(admin, courseUuid, quizId);
    if (!stepId) {
      stats.skippedNoStep += 1;
      return;
    }
    await upsertStepProgress(admin, studentId, courseUuid, stepId, step.completedAt, stats);
    return;
  }

  stats.skippedNoStep += 1;
}

async function maybeMarkEnrollmentComplete(
  admin: AdminClient,
  course: ProposedCourseProgress,
  studentId: string,
  courseUuid: string,
  stats: MigrateProgressWriteStats
): Promise<void> {
  if (!course.courseCompleted) return;
  const { data, error } = await fromTable(admin, "enrollments")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("course_id", courseUuid)
    .maybeSingle();
  if (error) {
    stats.errors.push(`enrollment lookup: ${error.message}`);
    return;
  }
  if (!data) return;
  if (data.status === "completed") return;
  const { error: updErr } = await fromTable(admin, "enrollments")
    .update({
      status: "completed",
      completed_at: course.dateCompleted || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
  if (updErr) {
    stats.errors.push(`enrollment complete: ${updErr.message}`);
    return;
  }
  stats.enrollmentsMarkedComplete += 1;
}

export async function migrateLearnDashProgress(
  options: MigrateProgressOptions
): Promise<MigrateProgressResult> {
  assertLearndashMigrationWriteAllowed({
    dryRun: options.dryRun,
    allowProductionWrite: options.allowProductionWrite,
  });

  const inspection = await inspectLearnDashProgress({
    courseId: options.courseId,
    allCourses: options.allCourses,
  });

  const result: MigrateProgressResult = {
    dryRun: options.dryRun,
    proposed: inspection.proposed,
    report: inspection.report,
  };

  if (options.dryRun) return result;

  const admin = createAdminClient();
  const stats: MigrateProgressWriteStats = {
    lessonProgressUpserted: 0,
    topicProgressUpserted: 0,
    stepProgressUpserted: 0,
    enrollmentsMarkedComplete: 0,
    skippedNoProfile: 0,
    skippedNoCourse: 0,
    skippedNoLesson: 0,
    skippedNoTopic: 0,
    skippedNoQuiz: 0,
    skippedNoStep: 0,
    skippedIncomplete: 0,
    failed: 0,
    errors: [],
  };

  const profileCache = new Map<number, string | null>();
  const courseCache = new Map<number, string | null>();
  const lessonCache = new Map<number, string | null>();
  const topicCache = new Map<number, string | null>();
  const quizCache = new Map<number, string | null>();

  for (const course of inspection.proposed.courses) {
    const studentId = await resolveProfileId(admin, profileCache, course.wordpressUserId);
    if (!studentId) {
      stats.skippedNoProfile += 1;
      continue;
    }
    const courseUuid = await resolveCourseId(admin, courseCache, course.wordpressCourseId);
    if (!courseUuid) {
      stats.skippedNoCourse += 1;
      continue;
    }

    for (const step of course.steps) {
      try {
        await writeCompletedStep(
          admin,
          step,
          studentId,
          courseUuid,
          { lessons: lessonCache, topics: topicCache, quizzes: quizCache },
          stats
        );
      } catch (err) {
        stats.failed += 1;
        stats.errors.push(
          `step ${step.wordpressStepId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    try {
      await maybeMarkEnrollmentComplete(admin, course, studentId, courseUuid, stats);
    } catch (err) {
      stats.errors.push(
        `complete enrollment: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  result.written = stats;
  return result;
}

export function formatMigrateProgressWriteReport(stats: MigrateProgressWriteStats): string {
  const lines = [
    "=== Progress write results ===",
    `lesson_progress upserted:   ${stats.lessonProgressUpserted}`,
    `topic_progress upserted:    ${stats.topicProgressUpserted}`,
    `step_progress upserted:     ${stats.stepProgressUpserted}`,
    `enrollments marked complete:${stats.enrollmentsMarkedComplete}`,
    `skipped no profile:         ${stats.skippedNoProfile}`,
    `skipped no course:          ${stats.skippedNoCourse}`,
    `skipped no lesson map:      ${stats.skippedNoLesson}`,
    `skipped no topic map:       ${stats.skippedNoTopic}`,
    `skipped no quiz map:        ${stats.skippedNoQuiz}`,
    `skipped no course_step:     ${stats.skippedNoStep}`,
    `skipped incomplete steps:   ${stats.skippedIncomplete}`,
    `failed:                     ${stats.failed}`,
  ];
  if (stats.errors.length) {
    lines.push("", "--- Errors (sample) ---");
    for (const e of stats.errors.slice(0, 25)) lines.push(`  • ${e}`);
    if (stats.errors.length > 25) lines.push(`  … +${stats.errors.length - 25} more`);
  }
  return lines.join("\n");
}

export { formatProgressReport };

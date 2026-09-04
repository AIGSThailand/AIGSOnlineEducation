import {
  migrateLearnDashCourse,
  type MigrateCourseOptions,
  type MigrateCourseResult,
} from "./migrate-course";
import { listLearnDashCourses, type LearnDashCourseListItem } from "@/lib/learndash/api/courses";
import { decodeHtmlEntities } from "./html";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";

export type MigrateAllCoursesOptions = Omit<MigrateCourseOptions, "courseId"> & {
  /** Limit to these WP course IDs (optional). */
  onlyIds?: LearnDashEntityId[];
  /** Skip these WP course IDs. */
  skipIds?: LearnDashEntityId[];
  /** Include draft/private courses (status=any). Default publish only. */
  includeDrafts?: boolean;
  /** Continue after a course failure. Default true. */
  continueOnError?: boolean;
  /** Resume after this WP course id (exclusive). */
  afterId?: LearnDashEntityId;
};

export type MigrateAllCourseItemResult = {
  course: LearnDashCourseListItem;
  ok: boolean;
  error?: string;
  result?: MigrateCourseResult;
};

export type MigrateAllCoursesResult = {
  dryRun: boolean;
  withQuestions: boolean;
  courses: LearnDashCourseListItem[];
  items: MigrateAllCourseItemResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    lessons: number;
    quizzes: number;
    steps: number;
    questions: number;
    options: number;
  };
};

function tallyItem(item: MigrateAllCourseItemResult): {
  lessons: number;
  quizzes: number;
  steps: number;
  questions: number;
  options: number;
} {
  const empty = { lessons: 0, quizzes: 0, steps: 0, questions: 0, options: 0 };
  if (!item.result) return empty;

  const { result } = item;
  let lessons = 0;
  let quizzes = 0;
  let steps = 0;
  let questions = 0;
  let options = 0;

  if (result.written) {
    lessons = result.written.lessons;
    quizzes = result.written.quizzes;
    steps = result.written.steps;
  } else {
    lessons = result.proposed.summary.lessons;
    quizzes = result.proposed.summary.quizzes + result.proposed.summary.exams;
    steps = lessons + quizzes;
  }

  if (result.questions?.written) {
    questions = result.questions.written.questions;
    options = result.questions.written.options;
  } else if (result.questions) {
    for (const q of result.questions.quizzes) {
      questions += q.summary.questions;
      options += q.questions.reduce((n, row) => n + row.options.length, 0);
    }
  }

  return { lessons, quizzes, steps, questions, options };
}

/**
 * Migrate every LearnDash course (curriculum + optional questions).
 * Runs sequentially to avoid hammering WordPress / Supabase.
 */
export async function migrateAllLearnDashCourses(
  options: MigrateAllCoursesOptions
): Promise<MigrateAllCoursesResult> {
  const continueOnError = options.continueOnError !== false;
  const listed = await listLearnDashCourses({
    status: options.includeDrafts ? "any" : "publish",
  });

  let courses = listed.map((c) => ({
    ...c,
    title: decodeHtmlEntities(c.title),
  }));

  if (options.onlyIds?.length) {
    const set = new Set(options.onlyIds.map(Number));
    courses = courses.filter((c) => set.has(c.id));
  }
  if (options.skipIds?.length) {
    const set = new Set(options.skipIds.map(Number));
    courses = courses.filter((c) => !set.has(c.id));
  }
  if (options.afterId != null) {
    courses = courses.filter((c) => c.id > options.afterId!);
  }

  const batchId =
    options.batchId ||
    `ld-all-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const items: MigrateAllCourseItemResult[] = [];

  for (let i = 0; i < courses.length; i++) {
    const course = courses[i];
    console.log(`\n[${i + 1}/${courses.length}] Course ${course.id}: ${course.title}`);

    try {
      const result = await migrateLearnDashCourse({
        courseId: course.id,
        dryRun: options.dryRun,
        allowProductionWrite: options.allowProductionWrite,
        policy: options.policy,
        batchId: `${batchId}-${course.id}`,
        withQuestions: options.withQuestions,
      });

      items.push({ course, ok: true, result });
      const t = tallyItem({ course, ok: true, result });
      console.log(
        `  OK — lessons=${t.lessons} quizzes=${t.quizzes}` +
          (options.withQuestions ? ` questions=${t.questions} options=${t.options}` : "")
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      items.push({ course, ok: false, error: message });
      console.error(`  FAIL — ${message}`);
      if (!continueOnError) break;
    }
  }

  const summary = {
    total: courses.length,
    succeeded: items.filter((i) => i.ok).length,
    failed: items.filter((i) => !i.ok).length,
    lessons: 0,
    quizzes: 0,
    steps: 0,
    questions: 0,
    options: 0,
  };

  for (const item of items) {
    const t = tallyItem(item);
    summary.lessons += t.lessons;
    summary.quizzes += t.quizzes;
    summary.steps += t.steps;
    summary.questions += t.questions;
    summary.options += t.options;
  }

  return {
    dryRun: options.dryRun,
    withQuestions: Boolean(options.withQuestions),
    courses,
    items,
    summary,
  };
}

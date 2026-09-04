import { createAdminClient } from "@/lib/supabase/admin";
import { wordpressContentToHtml } from "@/lib/utils/wordpress-content";
import { assertLearndashMigrationWriteAllowed } from "./env-safety";
import { inspectLearnDashCourse } from "./inspect-course";
import {
  formatProposedCurriculumReport,
  transformLearnDashCurriculum,
} from "./transform-curriculum";
import {
  migrateLearnDashQuestions,
  type MigrateQuestionsResult,
} from "./migrate-questions";
import type { MappingPolicyId, ProposedAigsCurriculum, ProposedCurriculumItem } from "./proposed-types";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";

export type MigrateCourseOptions = {
  courseId: LearnDashEntityId;
  dryRun: boolean;
  allowProductionWrite: boolean;
  policy?: MappingPolicyId;
  batchId?: string;
  /** Phase 3: also fetch/write quiz questions + options. */
  withQuestions?: boolean;
};

export type MigrateCourseResult = {
  dryRun: boolean;
  proposed: ProposedAigsCurriculum;
  report: string;
  written?: {
    courseId: string;
    wordpressCourseId: number;
    sections: number;
    lessons: number;
    quizzes: number;
    steps: number;
    mapRows: number;
  };
  questions?: MigrateQuestionsResult;
};

function collectQuizWordpressIds(proposed: ProposedAigsCurriculum): number[] {
  const ids: number[] = [];
  for (const section of proposed.sections) {
    for (const item of section.items) {
      if (
        (item.type === "quiz" || item.type === "exam") &&
        item.source.type === "sfwd-quiz" &&
        item.source.id != null
      ) {
        ids.push(item.source.id);
      }
    }
  }
  return Array.from(new Set(ids));
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Bypass incomplete Database Relationships typing that makes `.upsert()` expect `never[]`.
 * Same pattern as Stripe webhook admin writes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromTable(admin: AdminClient, table: string): any {
  return (admin as any).from(table);
}

/** wordpress_migration_map is not yet in generated Database types. */
function migrationMap(admin: AdminClient) {
  return fromTable(admin, "wordpress_migration_map");
}

async function upsertMapRow(
  admin: AdminClient,
  row: {
    source_type: string;
    wordpress_id: number;
    target_type: string;
    target_id: string;
    source_url?: string | null;
    migration_batch_id?: string | null;
    source_data?: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await migrationMap(admin).upsert(row, {
    onConflict: "source_type,wordpress_id",
  });
  if (error) {
    throw new Error(`wordpress_migration_map upsert failed: ${error.message}`);
  }
}

async function findMappedTarget(
  admin: AdminClient,
  sourceType: string,
  wordpressId: number
): Promise<string | null> {
  const { data, error } = await migrationMap(admin)
    .select("target_id")
    .eq("source_type", sourceType)
    .eq("wordpress_id", wordpressId)
    .maybeSingle();
  if (error) {
    throw new Error(`wordpress_migration_map lookup failed: ${error.message}`);
  }
  return data?.target_id ?? null;
}

async function upsertLessonFromItem(
  admin: AdminClient,
  courseUuid: string,
  moduleId: string | null,
  item: ProposedCurriculumItem,
  sortOrder: number
): Promise<string> {
  const content = wordpressContentToHtml(item.contentHtml);
  const excerpt = item.excerpt ? wordpressContentToHtml(item.excerpt) : null;

  if (item.source.type === "sfwd-lessons" && item.source.id != null) {
    const row = {
      title: item.title,
      slug: item.slug,
      content,
      excerpt,
      status: item.status,
      wordpress_lesson_id: item.source.id,
      course_id: courseUuid,
      module_id: moduleId,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await fromTable(admin, "lessons")
      .upsert(row, { onConflict: "wordpress_lesson_id" })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Lesson upsert (wp ${item.source.id}): ${error?.message || "no data"}`);
    }
    return data.id as string;
  }

  if (item.source.type === "sfwd-topic" && item.source.id != null) {
    const existingId = await findMappedTarget(admin, "sfwd-topic", item.source.id);
    if (existingId) {
      const { error } = await fromTable(admin, "lessons")
        .update({
          title: item.title,
          slug: item.slug,
          content,
          excerpt,
          status: item.status,
          course_id: courseUuid,
          module_id: moduleId,
          sort_order: sortOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId);
      if (error) {
        throw new Error(`Topic→lesson update ${item.source.id}: ${error.message}`);
      }
      return existingId;
    }

    const { data, error } = await fromTable(admin, "lessons")
      .insert({
        title: item.title,
        slug: item.slug,
        content,
        excerpt,
        status: item.status,
        course_id: courseUuid,
        module_id: moduleId,
        sort_order: sortOrder,
        wordpress_lesson_id: null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new Error(`Topic→lesson insert ${item.source.id}: ${error?.message || "no data"}`);
    }
    return data.id as string;
  }

  throw new Error(`Unsupported lesson source: ${item.source.type}`);
}

async function upsertQuizFromItem(
  admin: AdminClient,
  item: ProposedCurriculumItem
): Promise<string> {
  if (item.source.type !== "sfwd-quiz" || item.source.id == null) {
    throw new Error(`Unsupported quiz source: ${item.source.type}`);
  }
  const row = {
    title: item.title,
    slug: item.slug,
    description: null as string | null,
    status: item.status,
    wordpress_quiz_id: item.source.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await fromTable(admin, "quizzes")
    .upsert(row, { onConflict: "wordpress_quiz_id" })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Quiz upsert (wp ${item.source.id}): ${error?.message || "no data"}`);
  }
  return data.id as string;
}

/**
 * Inspect → transform → optional Supabase write for one LearnDash course.
 * Idempotent via wordpress_*_id + wordpress_migration_map.
 */
export async function migrateLearnDashCourse(
  options: MigrateCourseOptions
): Promise<MigrateCourseResult> {
  assertLearndashMigrationWriteAllowed({
    dryRun: options.dryRun,
    allowProductionWrite: options.allowProductionWrite,
  });

  const inspection = await inspectLearnDashCourse(options.courseId);
  const proposed = transformLearnDashCurriculum(inspection, options.policy);
  let report = formatProposedCurriculumReport(proposed);
  let questionsResult: MigrateQuestionsResult | undefined;

  if (options.withQuestions && options.dryRun) {
    const quizIds = collectQuizWordpressIds(proposed);
    questionsResult = await migrateLearnDashQuestions({
      wordpressQuizIds: quizIds,
      dryRun: true,
      allowProductionWrite: options.allowProductionWrite,
      batchId: options.batchId,
    });
    report = `${report}\n\n${questionsResult.report}`;
  }

  if (options.dryRun) {
    return { dryRun: true, proposed, report, questions: questionsResult };
  }

  const admin = createAdminClient();
  const batchId =
    options.batchId ||
    `ld-rest-${options.courseId}-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  const courseRow = {
    title: proposed.course.title,
    slug: proposed.course.slug,
    description: wordpressContentToHtml(proposed.course.descriptionHtml),
    excerpt: proposed.course.excerpt
      ? wordpressContentToHtml(proposed.course.excerpt)
      : null,
    status: proposed.course.status,
    wordpress_course_id: proposed.course.wordpressCourseId,
    updated_at: new Date().toISOString(),
  };

  const { data: course, error: courseErr } = await fromTable(admin, "courses")
    .upsert(courseRow, { onConflict: "wordpress_course_id" })
    .select("id")
    .single();

  if (courseErr || !course) {
    throw new Error(`Course upsert failed: ${courseErr?.message || "no data"}`);
  }

  const courseUuid = course.id as string;
  let mapRows = 0;

  await upsertMapRow(admin, {
    source_type: "sfwd-courses",
    wordpress_id: proposed.course.wordpressCourseId,
    target_type: "course",
    target_id: courseUuid,
    source_url: proposed.course.sourceUrl,
    migration_batch_id: batchId,
    source_data: { policy: proposed.policy, title: proposed.course.title },
  });
  mapRows += 1;

  // Rebuild placement: delete steps then sections/modules for this course
  const { error: delStepsErr } = await fromTable(admin, "course_steps")
    .delete()
    .eq("course_id", courseUuid);
  if (delStepsErr) {
    throw new Error(`Delete course_steps failed: ${delStepsErr.message}`);
  }

  const { data: oldSections } = await fromTable(admin, "course_sections")
    .select("id")
    .eq("course_id", courseUuid);
  const oldSectionIds = ((oldSections || []) as { id: string }[]).map((s) => s.id);

  const { error: delSecErr } = await fromTable(admin, "course_sections")
    .delete()
    .eq("course_id", courseUuid);
  if (delSecErr) {
    throw new Error(`Delete course_sections failed: ${delSecErr.message}`);
  }

  if (oldSectionIds.length > 0) {
    await fromTable(admin, "modules").delete().in("id", oldSectionIds);
  } else {
    await fromTable(admin, "modules").delete().eq("course_id", courseUuid);
  }

  let lessonCount = 0;
  let quizCount = 0;
  let stepCount = 0;
  let globalSort = 0;

  for (const section of proposed.sections) {
    const wordpressSectionId =
      section.source.type === "sfwd-lessons" && section.source.id != null
        ? section.source.id
        : null;

    const { data: sectionRow, error: secErr } = await fromTable(admin, "course_sections")
      .insert({
        course_id: courseUuid,
        title: section.title,
        sort_order: section.position,
        wordpress_section_id: wordpressSectionId,
      })
      .select("id")
      .single();

    if (secErr || !sectionRow) {
      throw new Error(`Section insert "${section.title}": ${secErr?.message || "no data"}`);
    }

    const sectionId = sectionRow.id as string;

    const { error: modErr } = await fromTable(admin, "modules").upsert(
      {
        id: sectionId,
        course_id: courseUuid,
        title: section.title,
        sort_order: section.position,
      },
      { onConflict: "id" }
    );
    if (modErr) {
      throw new Error(`Module mirror "${section.title}": ${modErr.message}`);
    }

    // One WP id → one map row. Prefer lesson content over section shell when both.
    const sectionAlsoHasSameLesson = section.items.some(
      (i) =>
        i.type === "lesson" &&
        i.source.type === "sfwd-lessons" &&
        i.source.id === wordpressSectionId
    );
    if (wordpressSectionId != null && !sectionAlsoHasSameLesson) {
      await upsertMapRow(admin, {
        source_type: "sfwd-lessons",
        wordpress_id: wordpressSectionId,
        target_type: "section",
        target_id: sectionId,
        migration_batch_id: batchId,
        source_data: { role: "section-shell", policy: proposed.policy },
      });
      mapRows += 1;
    }

    for (const item of section.items) {
      if (item.type === "lesson") {
        const lessonId = await upsertLessonFromItem(
          admin,
          courseUuid,
          sectionId,
          item,
          item.position
        );
        lessonCount += 1;

        if (item.source.id != null) {
          await upsertMapRow(admin, {
            source_type: item.source.type === "sfwd-topic" ? "sfwd-topic" : "sfwd-lessons",
            wordpress_id: item.source.id,
            target_type: "lesson",
            target_id: lessonId,
            migration_batch_id: batchId,
            source_data: { policy: proposed.policy },
          });
          mapRows += 1;
        }

        const { error: stepErr } = await fromTable(admin, "course_steps").insert({
          course_id: courseUuid,
          step_type: "lesson",
          lesson_id: lessonId,
          section_id: sectionId,
          sort_order: globalSort++,
          is_required: true,
        });
        if (stepErr) {
          throw new Error(`Lesson step "${item.title}": ${stepErr.message}`);
        }
        stepCount += 1;
        continue;
      }

      // quiz | exam → quizzes table + quiz step
      const quizId = await upsertQuizFromItem(admin, item);
      quizCount += 1;

      if (item.source.id != null) {
        await upsertMapRow(admin, {
          source_type: "sfwd-quiz",
          wordpress_id: item.source.id,
          target_type: "quiz",
          target_id: quizId,
          migration_batch_id: batchId,
          source_data: { asExam: item.type === "exam", policy: proposed.policy },
        });
        mapRows += 1;
      }

      const { error: stepErr } = await fromTable(admin, "course_steps").insert({
        course_id: courseUuid,
        step_type: "quiz",
        quiz_id: quizId,
        section_id: sectionId,
        sort_order: globalSort++,
        is_required: true,
      });
      if (stepErr) {
        throw new Error(`Quiz step "${item.title}": ${stepErr.message}`);
      }
      stepCount += 1;
    }
  }

  let reportOut = report;
  if (options.withQuestions) {
    const quizIds = collectQuizWordpressIds(proposed);
    questionsResult = await migrateLearnDashQuestions({
      wordpressQuizIds: quizIds,
      dryRun: false,
      allowProductionWrite: options.allowProductionWrite,
      batchId,
    });
    reportOut = `${report}\n\n${questionsResult.report}`;
  }

  return {
    dryRun: false,
    proposed,
    report: reportOut,
    written: {
      courseId: courseUuid,
      wordpressCourseId: proposed.course.wordpressCourseId,
      sections: proposed.sections.length,
      lessons: lessonCount,
      quizzes: quizCount,
      steps: stepCount,
      mapRows,
    },
    questions: questionsResult,
  };
}

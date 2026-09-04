import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLearnDashQuestionsForQuiz } from "@/lib/learndash/api/questions";
import { getLearnDashQuizSafe } from "@/lib/learndash/api/content";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import { assertLearndashMigrationWriteAllowed } from "./env-safety";
import {
  formatQuizQuestionsReport,
  transformLearnDashQuizQuestions,
  type ProposedQuizQuestions,
} from "./transform-questions";

export type MigrateQuestionsOptions = {
  /** WordPress quiz post IDs to import questions for. */
  wordpressQuizIds: LearnDashEntityId[];
  dryRun: boolean;
  allowProductionWrite: boolean;
  batchId?: string;
};

export type MigrateQuestionsResult = {
  dryRun: boolean;
  quizzes: ProposedQuizQuestions[];
  report: string;
  written?: {
    quizzesUpdated: number;
    questions: number;
    options: number;
    links: number;
    mapRows: number;
  };
};

type AdminClient = ReturnType<typeof createAdminClient>;

/** Bypass incomplete Database Relationships typing (`upsert` → `never[]`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromTable(admin: AdminClient, table: string): any {
  return (admin as any).from(table);
}

function migrationMap(admin: AdminClient) {
  return fromTable(admin, "wordpress_migration_map");
}

function truthy(value: unknown): boolean {
  return value === true || value === "1" || value === 1 || value === "on" || value === "true";
}

async function resolveQuizUuid(
  admin: AdminClient,
  wordpressQuizId: number
): Promise<string | null> {
  const { data, error } = await fromTable(admin, "quizzes")
    .select("id")
    .eq("wordpress_quiz_id", wordpressQuizId)
    .maybeSingle();
  if (error) throw new Error(`Quiz lookup ${wordpressQuizId}: ${error.message}`);
  return (data?.id as string | undefined) ?? null;
}

async function enrichQuizMetadata(
  admin: AdminClient,
  wordpressQuizId: number,
  quizUuid: string
): Promise<void> {
  const quiz = await getLearnDashQuizSafe(wordpressQuizId);
  if (!quiz) return;

  const passing = Number(quiz.passing_percentage ?? 80);
  const timeLimitEnabled = truthy(quiz.time_limit_enabled);
  const timeLimit = Number(quiz.time_limit_time ?? 0);
  const repeatsRaw = quiz.retry_repeats;
  const maxAttempts =
    truthy(quiz.retry_restrictions_enabled) &&
    repeatsRaw !== "" &&
    repeatsRaw != null &&
    Number(repeatsRaw) > 0
      ? Number(repeatsRaw)
      : null;

  const { error } = await fromTable(admin, "quizzes")
    .update({
      passing_percentage: Number.isFinite(passing) ? passing : 80,
      time_limit_seconds: timeLimitEnabled && timeLimit > 0 ? timeLimit : null,
      max_attempts: maxAttempts,
      require_all_questions: truthy(quiz.answer_all_questions_enabled),
      randomize_questions: truthy(quiz.question_random) || String(quiz.quiz_modus) === "1",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quizUuid);

  if (error) {
    throw new Error(`Quiz metadata update ${wordpressQuizId}: ${error.message}`);
  }
}

/**
 * Fetch + transform (and optionally write) questions/options for quiz WP IDs.
 * Requires quiz stubs already present in `quizzes` when writing.
 */
export async function migrateLearnDashQuestions(
  options: MigrateQuestionsOptions
): Promise<MigrateQuestionsResult> {
  assertLearndashMigrationWriteAllowed({
    dryRun: options.dryRun,
    allowProductionWrite: options.allowProductionWrite,
  });

  const uniqueQuizIds = Array.from(
    new Set(options.wordpressQuizIds.filter((id) => id > 0))
  );
  const quizzes: ProposedQuizQuestions[] = [];
  const reportParts: string[] = [];

  for (const quizId of uniqueQuizIds) {
    console.log(`  Fetching questions for quiz ${quizId}…`);
    const bundles = await fetchLearnDashQuestionsForQuiz(quizId);
    const proposed = transformLearnDashQuizQuestions(quizId, bundles);
    quizzes.push(proposed);
    reportParts.push(formatQuizQuestionsReport(proposed));
    for (const q of proposed.questions) {
      for (const w of q.warnings) reportParts.push(`  WARN: ${w}`);
    }
  }

  const report = reportParts.join("\n\n");

  if (options.dryRun) {
    return { dryRun: true, quizzes, report };
  }

  const admin = createAdminClient();
  const batchId =
    options.batchId || `ld-questions-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  let quizzesUpdated = 0;
  let questionCount = 0;
  let optionCount = 0;
  let linkCount = 0;
  let mapRows = 0;

  for (const proposed of quizzes) {
    const quizUuid = await resolveQuizUuid(admin, proposed.wordpressQuizId);
    if (!quizUuid) {
      throw new Error(
        `Quiz wordpress_quiz_id=${proposed.wordpressQuizId} not found in Supabase. Run course migrate --write first.`
      );
    }

    await enrichQuizMetadata(admin, proposed.wordpressQuizId, quizUuid);
    quizzesUpdated += 1;

    // Rebuild quiz_questions links for this quiz
    const { error: delLinksErr } = await fromTable(admin, "quiz_questions")
      .delete()
      .eq("quiz_id", quizUuid);
    if (delLinksErr) {
      throw new Error(`Delete quiz_questions for ${proposed.wordpressQuizId}: ${delLinksErr.message}`);
    }

    for (const q of proposed.questions) {
      const questionRow = {
        wordpress_question_id: q.wordpressQuestionId,
        title: q.title,
        question_text: q.questionText,
        question_type: q.questionType,
        default_points: q.defaultPoints,
        explanation: q.explanation,
        updated_at: new Date().toISOString(),
      };

      const { data: question, error: qErr } = await fromTable(admin, "questions")
        .upsert(questionRow, { onConflict: "wordpress_question_id" })
        .select("id")
        .single();

      if (qErr || !question) {
        throw new Error(
          `Question upsert ${q.wordpressQuestionId}: ${qErr?.message || "no data"}`
        );
      }

      questionCount += 1;

      const { error: mapErr } = await migrationMap(admin).upsert(
        {
          source_type: "sfwd-question",
          wordpress_id: q.wordpressQuestionId,
          target_type: "question",
          target_id: question.id,
          migration_batch_id: batchId,
          source_data: {
            wordpress_quiz_id: proposed.wordpressQuizId,
            question_type: q.questionType,
            option_count: q.options.length,
          },
        },
        { onConflict: "source_type,wordpress_id" }
      );
      if (mapErr) {
        throw new Error(`migration_map question ${q.wordpressQuestionId}: ${mapErr.message}`);
      }
      mapRows += 1;

      const { error: delOptErr } = await fromTable(admin, "question_options")
        .delete()
        .eq("question_id", question.id);
      if (delOptErr) {
        throw new Error(`Delete options ${q.wordpressQuestionId}: ${delOptErr.message}`);
      }

      if (q.options.length > 0) {
        const optionRows = q.options.map((o) => ({
          question_id: question.id,
          answer_text: o.answerText,
          is_correct: o.isCorrect,
          sort_order: o.sortOrder,
          feedback: o.feedback,
        }));
        const { error: optErr } = await fromTable(admin, "question_options").insert(optionRows);
        if (optErr) {
          throw new Error(`Insert options ${q.wordpressQuestionId}: ${optErr.message}`);
        }
        optionCount += optionRows.length;
      }

      const { error: linkErr } = await fromTable(admin, "quiz_questions").insert({
        quiz_id: quizUuid,
        question_id: question.id,
        sort_order: q.sortOrder,
        points_override: q.defaultPoints !== 1 ? q.defaultPoints : null,
      });
      if (linkErr) {
        throw new Error(`quiz_questions link ${q.wordpressQuestionId}: ${linkErr.message}`);
      }
      linkCount += 1;
    }
  }

  return {
    dryRun: false,
    quizzes,
    report,
    written: {
      quizzesUpdated,
      questions: questionCount,
      options: optionCount,
      links: linkCount,
      mapRows,
    },
  };
}

/**
 * Phase 2–3 CLI: migrate one LearnDash course via REST → Supabase.
 *
 * Usage:
 *   npm run migrate:learndash-course -- 26475 --dry-run
 *   npm run migrate:learndash-course -- 26475 --dry-run --with-questions
 *   npm run migrate:learndash-course -- 26475 --write --with-questions
 *   npm run migrate:learndash-course -- 26475 --write --allow-production-write
 *
 * Requires LEARNDASH_* and (for --write) NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "fs";
import path from "path";
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { describeMigrationTarget } from "../features/migration/learndash/env-safety";
import { migrateLearnDashCourse } from "../features/migration/learndash/migrate-course";
import type { MappingPolicyId } from "../features/migration/learndash/proposed-types";

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArgs(argv: string[]): {
  courseId: number;
  dryRun: boolean;
  allowProductionWrite: boolean;
  withQuestions: boolean;
  policy?: MappingPolicyId;
  json: boolean;
} {
  const args = argv.filter((a) => a !== "--");
  const write = args.includes("--write");
  const dryRunFlag = args.includes("--dry-run");
  const dryRun = write ? false : true;
  if (write && dryRunFlag) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }

  const policyIdx = args.indexOf("--policy");
  let policy: MappingPolicyId | undefined;
  if (policyIdx >= 0) {
    const value = args[policyIdx + 1];
    if (value !== "flat-lessons" && value !== "topics-as-lessons") {
      throw new Error('--policy must be "flat-lessons" or "topics-as-lessons"');
    }
    policy = value;
  }

  const idArg = args.find((a) => !a.startsWith("--") && a !== policy);
  const courseId = Number(idArg || 26475);
  if (!Number.isFinite(courseId) || courseId <= 0) {
    throw new Error(
      "Usage: npm run migrate:learndash-course -- <courseId> [--dry-run|--write] [--with-questions]"
    );
  }

  return {
    courseId,
    dryRun,
    allowProductionWrite:
      args.includes("--allow-production-write") ||
      process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true",
    withQuestions: args.includes("--with-questions"),
    policy,
    json: args.includes("--json"),
  };
}

async function main(): Promise<void> {
  loadEnvLocal();

  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const target = describeMigrationTarget();
  console.log(`APP_ENV=${target.appEnv}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${target.supabaseUrl}`);
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);
  console.log(`mode=${opts.dryRun ? "DRY-RUN (no writes)" : "WRITE"}`);
  console.log(`withQuestions=${opts.withQuestions}`);
  if (opts.policy) console.log(`policy override=${opts.policy}`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      "LearnDash is not configured. Add LEARNDASH_BASE_URL, LEARNDASH_USERNAME, LEARNDASH_APP_PASSWORD to .env.local"
    );
    process.exit(1);
  }

  try {
    const result = await migrateLearnDashCourse({
      courseId: opts.courseId,
      dryRun: opts.dryRun,
      allowProductionWrite: opts.allowProductionWrite,
      policy: opts.policy,
      withQuestions: opts.withQuestions,
    });

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: result.dryRun,
            written: result.written ?? null,
            questionsWritten: result.questions?.written ?? null,
            questionSummaries: result.questions?.quizzes.map((q) => ({
              wordpressQuizId: q.wordpressQuizId,
              summary: q.summary,
            })),
            summary: result.proposed.summary,
            policy: result.proposed.policy,
            course: {
              title: result.proposed.course.title,
              slug: result.proposed.course.slug,
              wordpressCourseId: result.proposed.course.wordpressCourseId,
            },
            sections: result.proposed.sections.map((s) => ({
              title: s.title,
              items: s.items.map((i) => ({
                type: i.type,
                title: i.title,
                source: i.source,
              })),
            })),
            notes: result.proposed.notes,
          },
          null,
          2
        )
      );
    } else {
      console.log(result.report);
      if (result.written) {
        console.log("");
        console.log("WRITE RESULT");
        console.log(`  Supabase course id: ${result.written.courseId}`);
        console.log(`  Sections: ${result.written.sections}`);
        console.log(`  Lessons:  ${result.written.lessons}`);
        console.log(`  Quizzes:  ${result.written.quizzes}`);
        console.log(`  Steps:    ${result.written.steps}`);
        console.log(`  Map rows: ${result.written.mapRows}`);
      }
      if (result.questions?.written) {
        console.log("");
        console.log("QUESTIONS WRITE RESULT");
        console.log(`  Quizzes updated: ${result.questions.written.quizzesUpdated}`);
        console.log(`  Questions:       ${result.questions.written.questions}`);
        console.log(`  Options:         ${result.questions.written.options}`);
        console.log(`  Quiz↔Question:   ${result.questions.written.links}`);
        console.log(`  Map rows:        ${result.questions.written.mapRows}`);
      }
      if (result.dryRun) {
        console.log("");
        console.log("(Dry-run complete — no Supabase writes. Re-run with --write to apply.)");
      }
    }
  } catch (err) {
    if (err instanceof LearnDashError) {
      console.error(`[${err.code}] ${err.message}`);
      process.exit(1);
    }
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

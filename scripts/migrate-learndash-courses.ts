/**
 * Batch migrate all LearnDash courses via REST → Supabase.
 *
 * Usage:
 *   npm run migrate:learndash-courses -- --dry-run --with-questions
 *   npm run migrate:learndash-courses -- --write --with-questions
 *   npm run migrate:learndash-courses -- --write --with-questions --include-drafts
 *   npm run migrate:learndash-courses -- --write --with-questions --after 26475
 *   npm run migrate:learndash-courses -- --dry-run --only 26475,12345
 *
 * Requires LEARNDASH_* and (for --write) NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "fs";
import path from "path";
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { describeMigrationTarget } from "../features/migration/learndash/env-safety";
import { migrateAllLearnDashCourses } from "../features/migration/learndash/migrate-all-courses";
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

function parseIdList(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : undefined;
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  allowProductionWrite: boolean;
  withQuestions: boolean;
  includeDrafts: boolean;
  continueOnError: boolean;
  onlyIds?: number[];
  skipIds?: number[];
  afterId?: number;
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

  const onlyIdx = args.indexOf("--only");
  const skipIdx = args.indexOf("--skip");
  const afterIdx = args.indexOf("--after");

  return {
    dryRun,
    allowProductionWrite:
      args.includes("--allow-production-write") ||
      process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true",
    withQuestions: args.includes("--with-questions"),
    includeDrafts: args.includes("--include-drafts"),
    continueOnError: !args.includes("--fail-fast"),
    onlyIds: parseIdList(onlyIdx >= 0 ? args[onlyIdx + 1] : undefined),
    skipIds: parseIdList(skipIdx >= 0 ? args[skipIdx + 1] : undefined),
    afterId:
      afterIdx >= 0 && Number(args[afterIdx + 1]) > 0
        ? Number(args[afterIdx + 1])
        : undefined,
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
  console.log(`includeDrafts=${opts.includeDrafts}`);
  if (opts.onlyIds) console.log(`only=${opts.onlyIds.join(",")}`);
  if (opts.skipIds) console.log(`skip=${opts.skipIds.join(",")}`);
  if (opts.afterId) console.log(`after=${opts.afterId}`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      "LearnDash is not configured. Add LEARNDASH_BASE_URL, LEARNDASH_USERNAME, LEARNDASH_APP_PASSWORD to .env.local"
    );
    process.exit(1);
  }

  try {
    const result = await migrateAllLearnDashCourses({
      dryRun: opts.dryRun,
      allowProductionWrite: opts.allowProductionWrite,
      withQuestions: opts.withQuestions,
      includeDrafts: opts.includeDrafts,
      continueOnError: opts.continueOnError,
      onlyIds: opts.onlyIds,
      skipIds: opts.skipIds,
      afterId: opts.afterId,
      policy: opts.policy,
    });

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: result.dryRun,
            summary: result.summary,
            courses: result.items.map((item) => ({
              id: item.course.id,
              title: item.course.title,
              ok: item.ok,
              error: item.error ?? null,
              written: item.result?.written ?? null,
              questionsWritten: item.result?.questions?.written ?? null,
            })),
          },
          null,
          2
        )
      );
    } else {
      console.log("\n========== BATCH SUMMARY ==========");
      console.log(`  Courses:   ${result.summary.succeeded}/${result.summary.total} ok`);
      console.log(`  Failed:    ${result.summary.failed}`);
      console.log(`  Lessons:   ${result.summary.lessons}`);
      console.log(`  Quizzes:   ${result.summary.quizzes}`);
      console.log(`  Steps:     ${result.summary.steps}`);
      if (opts.withQuestions) {
        console.log(`  Questions: ${result.summary.questions}`);
        console.log(`  Options:   ${result.summary.options}`);
      }
      if (result.summary.failed > 0) {
        console.log("\nFailures:");
        for (const item of result.items.filter((i) => !i.ok)) {
          console.log(`  - ${item.course.id} ${item.course.title}: ${item.error}`);
        }
      }
      if (result.dryRun) {
        console.log("\n(Dry-run complete — no Supabase writes. Re-run with --write to apply.)");
      }
    }

    if (result.summary.failed > 0) process.exit(1);
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

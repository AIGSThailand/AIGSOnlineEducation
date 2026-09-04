/**
 * Phase 5 CLI: migrate LearnDash progress for enrolled users.
 *
 *   npm run migrate:learndash-progress -- 26475 --dry-run
 *   npm run migrate:learndash-progress -- 26475 --write
 *   npm run migrate:learndash-progress -- --all --env staging --write
 */
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { describeMigrationTarget } from "../features/migration/learndash/env-safety";
import {
  formatMigrateProgressWriteReport,
  migrateLearnDashProgress,
} from "../features/migration/learndash/migrate-progress";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

function parseArgs(argv: string[]) {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const write = args.includes("--write");
  const dryRunFlag = args.includes("--dry-run");
  if (write && dryRunFlag) throw new Error("Pass either --dry-run or --write, not both.");
  const allCourses = args.includes("--all");
  const idArg = args.find((a) => !a.startsWith("--"));
  const courseId = idArg != null ? Number(idArg) : undefined;
  if (!allCourses && (courseId == null || !Number.isFinite(courseId) || courseId <= 0)) {
    throw new Error(
      "Usage: npm run migrate:learndash-progress -- <courseId>|--all [--dry-run|--write] [--json]"
    );
  }
  return {
    courseId: allCourses ? undefined : courseId,
    allCourses,
    dryRun: !write,
    allowProductionWrite:
      args.includes("--allow-production-write") ||
      process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true",
    json: args.includes("--json"),
  };
}

async function main(): Promise<void> {
  try {
    const envName = parseEnvFlag(process.argv);
    const loaded = loadCliEnv(envName);
    console.log(`env file=${loaded.filePath} (--env ${envName})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

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
  console.log(`mode=${opts.dryRun ? "dry-run" : "WRITE"}`);
  console.log(`scope=enrolled users only`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error("LearnDash is not configured.");
    process.exit(1);
  }

  try {
    const result = await migrateLearnDashProgress({
      courseId: opts.courseId,
      allCourses: opts.allCourses,
      dryRun: opts.dryRun,
      allowProductionWrite: opts.allowProductionWrite,
    });

    if (opts.json) {
      console.log(JSON.stringify({ dryRun: result.dryRun, summary: result.proposed.summary, written: result.written }, null, 2));
      return;
    }

    console.log(result.report);
    if (result.written) {
      console.log("");
      console.log(formatMigrateProgressWriteReport(result.written));
      if (result.written.errors.length > 0 || result.written.failed > 0) process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof LearnDashError) console.error(`[${err.code}] ${err.message}`);
    else console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

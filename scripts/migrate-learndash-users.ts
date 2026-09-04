/**
 * Phase 4b CLI: migrate enrolled LearnDash users → Supabase Auth + enrollments.
 *
 * Only users enrolled in the selected course(s) are imported (not the full WP directory).
 *
 * Auth strategy: email_confirm=true + random password (reset to sign in).
 *
 * Usage:
 *   npm run migrate:learndash-users -- 26475 --dry-run
 *   npm run migrate:learndash-users -- --all --dry-run
 *   npm run migrate:learndash-users -- 26475 --write
 *   npm run migrate:learndash-users -- --all --env staging --write
 *   npm run migrate:learndash-users -- --all --env production --write --allow-production-write
 */
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { describeMigrationTarget } from "../features/migration/learndash/env-safety";
import {
  formatMigrateUsersWriteReport,
  migrateLearnDashUsers,
} from "../features/migration/learndash/migrate-users";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

function parseArgs(argv: string[]): {
  courseId?: number;
  allCourses: boolean;
  dryRun: boolean;
  allowProductionWrite: boolean;
  json: boolean;
} {
  const args = stripEnvArgs(argv.filter((a) => a !== "--"));
  const write = args.includes("--write");
  const dryRunFlag = args.includes("--dry-run");
  if (write && dryRunFlag) {
    throw new Error("Pass either --dry-run or --write, not both.");
  }
  const dryRun = !write;

  const allCourses = args.includes("--all");
  const idArg = args.find((a) => !a.startsWith("--"));
  const courseId = idArg != null ? Number(idArg) : undefined;

  if (!allCourses && (courseId == null || !Number.isFinite(courseId) || courseId <= 0)) {
    throw new Error(
      "Usage: npm run migrate:learndash-users -- <courseId>|--all [--env local|staging|production] [--dry-run|--write] [--json]"
    );
  }

  return {
    courseId: allCourses ? undefined : courseId,
    allCourses,
    dryRun,
    allowProductionWrite:
      args.includes("--allow-production-write") ||
      process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true",
    json: args.includes("--json"),
  };
}

async function main(): Promise<void> {
  let envName: string;
  try {
    envName = parseEnvFlag(process.argv);
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
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);
  console.log(`mode=${opts.dryRun ? "dry-run" : "WRITE"}`);
  console.log(
    `scope=enrolled users only (Auth: email confirmed + random password; reset to sign in)`
  );
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      "LearnDash is not configured. Set LEARNDASH_BASE_URL, LEARNDASH_USERNAME, LEARNDASH_APP_PASSWORD."
    );
    process.exit(1);
  }

  if (!opts.dryRun) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Write mode requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
      process.exit(1);
    }
  }

  try {
    const result = await migrateLearnDashUsers({
      courseId: opts.courseId,
      allCourses: opts.allCourses,
      dryRun: opts.dryRun,
      allowProductionWrite: opts.allowProductionWrite,
    });

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            dryRun: result.dryRun,
            siteUserTotal: result.siteUserTotal,
            summary: result.proposed.summary,
            notes: result.proposed.notes,
            emailDuplicates: result.proposed.emailDuplicates,
            written: result.written,
            users: result.proposed.users,
            enrollments: result.proposed.enrollments,
          },
          null,
          2
        )
      );
      return;
    }

    console.log(`site WP user total (probe): ${result.siteUserTotal ?? "(unknown)"}`);
    console.log("");
    console.log(result.report);
    if (result.written) {
      console.log("");
      console.log(formatMigrateUsersWriteReport(result.written));
      if (result.written.errors.length > 0) {
        process.exitCode = 1;
      }
    }
  } catch (err) {
    if (err instanceof LearnDashError) {
      console.error(`[${err.code}] ${err.message}`);
      if (err.details) console.error(err.details);
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  }
}

main();

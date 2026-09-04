/**
 * Phase 5 CLI: migrate LearnDash groups + materialize group enrollments.
 *
 *   npm run migrate:learndash-groups -- --dry-run
 *   npm run migrate:learndash-groups -- --write
 *   npm run migrate:learndash-groups -- --env staging --write
 */
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { describeMigrationTarget } from "../features/migration/learndash/env-safety";
import {
  formatMigrateGroupsWriteReport,
  migrateLearnDashGroups,
} from "../features/migration/learndash/migrate-groups";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

async function main(): Promise<void> {
  try {
    const envName = parseEnvFlag(process.argv);
    const loaded = loadCliEnv(envName);
    console.log(`env file=${loaded.filePath} (--env ${envName})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const args = stripEnvArgs(process.argv.slice(2).filter((a) => a !== "--"));
  const write = args.includes("--write");
  const dryRunFlag = args.includes("--dry-run");
  if (write && dryRunFlag) {
    console.error("Pass either --dry-run or --write, not both.");
    process.exit(1);
  }
  const dryRun = !write;
  const jsonMode = args.includes("--json");
  const allowProductionWrite =
    args.includes("--allow-production-write") ||
    process.env.ALLOW_LEARNDASH_MIGRATE_PRODUCTION === "true";

  const target = describeMigrationTarget();
  console.log(`APP_ENV=${target.appEnv}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${target.supabaseUrl}`);
  console.log(`mode=${dryRun ? "dry-run" : "WRITE"}`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error("LearnDash is not configured.");
    process.exit(1);
  }

  try {
    const result = await migrateLearnDashGroups({ dryRun, allowProductionWrite });
    if (jsonMode) {
      console.log(
        JSON.stringify(
          { dryRun: result.dryRun, summary: result.proposed.summary, written: result.written },
          null,
          2
        )
      );
      return;
    }
    console.log(result.report);
    if (result.written) {
      console.log("");
      console.log(formatMigrateGroupsWriteReport(result.written));
      if (result.written.errors.length || result.written.usersFailed) process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof LearnDashError) console.error(`[${err.code}] ${err.message}`);
    else console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

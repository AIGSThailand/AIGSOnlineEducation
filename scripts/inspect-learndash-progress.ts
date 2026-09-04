/**
 * Phase 5 CLI: inspect LearnDash course progress (enrolled users only).
 *
 *   npm run inspect:learndash-progress -- 26475
 *   npm run inspect:learndash-progress -- --all [--json]
 */
import { inspectLearnDashProgress } from "../features/migration/learndash/inspect-progress";
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";

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

  const args = stripEnvArgs(process.argv.slice(2).filter((a) => a !== "--"));
  const jsonMode = args.includes("--json");
  const allCourses = args.includes("--all");
  const idArg = args.find((a) => !a.startsWith("--"));
  const courseId = idArg != null ? Number(idArg) : undefined;

  if (!allCourses && (courseId == null || !Number.isFinite(courseId) || courseId <= 0)) {
    console.error(
      "Usage: npm run inspect:learndash-progress -- <courseId>|--all [--env local|staging|production] [--json]"
    );
    process.exit(1);
  }

  console.log(`dryRun/inspection only — no Supabase writes`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error("LearnDash is not configured.");
    process.exit(1);
  }

  try {
    const inspection = await inspectLearnDashProgress(
      allCourses ? { allCourses: true } : { courseId: courseId! }
    );
    if (jsonMode) {
      console.log(JSON.stringify({ siteUserTotal: inspection.siteUserTotal, ...inspection.proposed }, null, 2));
      return;
    }
    console.log(`site WP user total (probe): ${inspection.siteUserTotal ?? "(unknown)"}`);
    console.log("");
    console.log(inspection.report);
  } catch (err) {
    if (err instanceof LearnDashError) {
      console.error(`[${err.code}] ${err.message}`);
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  }
}

main();

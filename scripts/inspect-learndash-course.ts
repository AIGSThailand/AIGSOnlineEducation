/**
 * Phase 1 CLI: inspect a LearnDash course via REST v2 (read-only).
 *
 * Usage:
 *   npm run inspect:learndash-course -- 26475
 *   npm run inspect:learndash-course -- 26475 --json
 *   npm run inspect:learndash-course -- 26475 --env staging
 *
 * Requires LEARNDASH_* in .env.local / .env.staging / .env.production (--env).
 */
import { inspectLearnDashCourse, formatCourseStructureReport } from "../features/migration/learndash/inspect-course";
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
  const idArg = args.find((a) => !a.startsWith("--"));
  const courseId = Number(idArg || 26475);

  if (!Number.isFinite(courseId) || courseId <= 0) {
    console.error(
      "Usage: npm run inspect:learndash-course -- <courseId> [--env local|staging|production] [--json]"
    );
    process.exit(1);
  }

  console.log(`APP_ENV=${process.env.APP_ENV || "(unset)"}`);
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);
  console.log(`dryRun/inspection only — no Supabase writes, no LearnDash writes`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      `LearnDash is not configured. Add to .env.${envName}:\n` +
        "  LEARNDASH_BASE_URL=https://your-wp-site.example\n" +
        "  LEARNDASH_USERNAME=...\n" +
        "  LEARNDASH_APP_PASSWORD=...\n"
    );
    process.exit(1);
  }

  try {
    const inspection = await inspectLearnDashCourse(courseId);
    if (jsonMode) {
      const slim = {
        ...inspection,
        entities: {
          lessons: inspection.entities.lessons.map((l) => ({
            id: l.id,
            slug: l.slug,
            status: l.status,
            title: l.title,
          })),
          topics: inspection.entities.topics.map((t) => ({
            id: t.id,
            slug: t.slug,
            status: t.status,
            title: t.title,
          })),
          quizzes: inspection.entities.quizzes.map((q) => ({
            id: q.id,
            slug: q.slug,
            status: q.status,
            title: q.title,
          })),
        },
      };
      console.log(JSON.stringify(slim, null, 2));
    } else {
      console.log(formatCourseStructureReport(inspection));
    }
  } catch (err) {
    if (err instanceof LearnDashError) {
      console.error(`[${err.code}] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

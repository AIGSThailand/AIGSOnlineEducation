/**
 * Phase 4 CLI: inspect LearnDash course users / enrollments (read-only).
 *
 * Usage:
 *   npm run inspect:learndash-users -- 26475
 *   npm run inspect:learndash-users -- --all
 *   npm run inspect:learndash-users -- 26475 --json
 *   npm run inspect:learndash-users -- --all --env staging
 *
 * Requires LEARNDASH_* in the selected env file (--env).
 */
import { inspectLearnDashUsersEnrollments } from "../features/migration/learndash/inspect-users-enrollments";
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
      "Usage: npm run inspect:learndash-users -- <courseId>|--all [--env local|staging|production] [--json]"
    );
    process.exit(1);
  }

  console.log(`APP_ENV=${process.env.APP_ENV || "(unset)"}`);
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);
  console.log(`dryRun/inspection only — no Supabase Auth writes, no LearnDash writes`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      `LearnDash is not configured. Add to env file:\n` +
        "  LEARNDASH_BASE_URL=https://your-wp-site.example\n" +
        "  LEARNDASH_USERNAME=...\n" +
        "  LEARNDASH_APP_PASSWORD=...\n"
    );
    process.exit(1);
  }

  try {
    const inspection = await inspectLearnDashUsersEnrollments(
      allCourses ? { allCourses: true } : { courseId: courseId! }
    );

    if (jsonMode) {
      const slim = {
        siteUserTotal: inspection.siteUserTotal,
        summary: inspection.proposed.summary,
        notes: inspection.proposed.notes,
        emailDuplicates: inspection.proposed.emailDuplicates,
        users: inspection.proposed.users,
        enrollments: inspection.proposed.enrollments,
        courses: inspection.snapshots.map((s) => ({
          wordpressCourseId: s.wordpressCourseId,
          courseTitle: s.courseTitle,
          userCount: s.users.length,
          source: s.source,
          usedV1Fallback: s.usedV1Fallback,
          v2Count: s.v2Count,
          v1Count: s.v1Count,
          warnings: s.warnings,
        })),
      };
      console.log(JSON.stringify(slim, null, 2));
      return;
    }

    console.log(`site WP user total (probe): ${inspection.siteUserTotal ?? "(unknown)"}`);
    console.log("");
    for (const s of inspection.snapshots) {
      console.log(
        `course ${s.wordpressCourseId} "${s.courseTitle}" — users=${s.users.length} via ${s.source}` +
          (s.usedV1Fallback ? " (v1 fallback)" : "") +
          (s.v1Count != null ? ` [v2=${s.v2Count}, v1=${s.v1Count}]` : "")
      );
    }
    console.log("");
    console.log(inspection.report);
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

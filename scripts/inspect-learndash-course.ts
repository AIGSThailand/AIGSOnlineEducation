/**
 * Phase 1 CLI: inspect a LearnDash course via REST v2 (read-only).
 *
 * Usage:
 *   npm run inspect:learndash-course -- 26475
 *   npm run inspect:learndash-course -- 26475 --json
 *
 * Requires LEARNDASH_BASE_URL, LEARNDASH_USERNAME, LEARNDASH_APP_PASSWORD in .env.local
 */
import fs from "fs";
import path from "path";
import { inspectLearnDashCourse, formatCourseStructureReport } from "../features/migration/learndash/inspect-course";
import { LearnDashError } from "../lib/learndash/errors";
import { isLearnDashConfigured } from "../lib/learndash/config";

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

async function main(): Promise<void> {
  loadEnvLocal();

  const args = process.argv.slice(2).filter((a) => a !== "--");
  const jsonMode = args.includes("--json");
  const idArg = args.find((a) => !a.startsWith("--"));
  const courseId = Number(idArg || 26475);

  if (!Number.isFinite(courseId) || courseId <= 0) {
    console.error("Usage: npm run inspect:learndash-course -- <courseId> [--json]");
    process.exit(1);
  }

  console.log(`APP_ENV=${process.env.APP_ENV || "(unset)"}`);
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);
  console.log(`dryRun/inspection only — no Supabase writes, no LearnDash writes`);
  console.log("");

  if (!isLearnDashConfigured()) {
    console.error(
      "LearnDash is not configured. Add to .env.local:\n" +
        "  LEARNDASH_BASE_URL=https://your-wp-site.example\n" +
        "  LEARNDASH_USERNAME=...\n" +
        "  LEARNDASH_APP_PASSWORD=...\n"
    );
    process.exit(1);
  }

  try {
    const inspection = await inspectLearnDashCourse(courseId);
    if (jsonMode) {
      // Avoid dumping huge HTML content in default summary — trim content fields
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

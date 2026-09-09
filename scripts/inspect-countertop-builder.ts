/**
 * Find Countertop Sketching course and print section headings from live LearnDash.
 * Usage: npx tsx scripts/inspect-countertop-builder.ts --env local
 */
import { loadCliEnv, parseEnvFlag } from "./lib/load-cli-env.mjs";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { listLearnDashCourses } from "../lib/learndash/api/courses";
import { getLearnDashCourseSections } from "../lib/learndash/api/sections";
import { getLearnDashCourseSteps } from "../lib/learndash/api/courses";
import { parseLearnDashCourseSteps, collectStepIds } from "../lib/learndash/parse-steps";
import { mapLessonIndexesToSectionIndexes } from "../lib/learndash/parse-sections";
import { inspectLearnDashCourse } from "../features/migration/learndash/inspect-course";
import { transformLearnDashCurriculum } from "../features/migration/learndash/transform-curriculum";

async function main() {
  const envName = parseEnvFlag(process.argv);
  const loaded = loadCliEnv(envName);
  console.log(`env file=${loaded.filePath} (--env ${envName})`);
  console.log(`LEARNDASH_BASE_URL=${process.env.LEARNDASH_BASE_URL ? "(set)" : "(missing)"}`);

  if (!isLearnDashConfigured()) {
    console.error("LearnDash not configured in this env file.");
    process.exit(1);
  }

  const courses = await listLearnDashCourses({ status: "any" });
  const matches = courses.filter(
    (c) =>
      /countertop/i.test(c.title) ||
      /countertop/i.test(c.slug) ||
      /中文版/.test(c.title) ||
      /sketching/i.test(c.title)
  );

  console.log(`\nPublished/any courses: ${courses.length}`);
  console.log(`Matches (countertop/sketching/中文版): ${matches.length}`);
  for (const m of matches) {
    console.log(`  id=${m.id} status=${m.status} slug=${m.slug}`);
    console.log(`    title=${m.title}`);
  }

  const target =
    matches.find((m) => m.id === 76822) ||
    matches.find((m) => /中文/.test(m.title) || /%e4%b8%ad%e6%96%87/i.test(m.slug)) ||
    matches.find((m) => /countertop-sketching/i.test(m.slug) && /中文|字幕/.test(m.title)) ||
    matches.find((m) => /countertop/i.test(m.title)) ||
    matches[0];

  if (!target) {
    console.error("\nNo matching course found. Listing first 20 titles:");
    for (const c of courses.slice(0, 20)) {
      console.log(`  ${c.id}: ${c.title}`);
    }
    process.exit(2);
  }

  console.log(`\n=== Inspecting course ${target.id} ===`);
  const sections = await getLearnDashCourseSections(target.id);
  console.log(`\nSection headings from REST (${sections.length}):`);
  if (sections.length === 0) {
    console.log("  (none — REST did not return course_sections)");
  } else {
    for (const s of sections) {
      console.log(
        `  order=${s.order} id=${s.wordpressSectionId ?? "-"} title=${s.title}` +
          (s.stepIds?.length ? ` steps=[${s.stepIds.join(",")}]` : "")
      );
    }
  }

  const rawSteps = await getLearnDashCourseSteps(target.id);
  const { roots } = parseLearnDashCourseSteps(rawSteps);
  const collected = collectStepIds(roots);
  const lessonRoots = roots.filter((r) => r.type === "lesson");
  console.log(`\nSteps tree: roots=${roots.length} lessons=${lessonRoots.length} topics=${collected.topicIds.length} quizzes=${collected.quizIds.length}`);

  if (sections.length > 0 && lessonRoots.length > 0) {
    const owners = mapLessonIndexesToSectionIndexes(
      lessonRoots.length,
      sections,
      lessonRoots.map((r) => r.id)
    );
    const counts = Array.from({ length: sections.length }, () => 0);
    for (const o of owners) counts[o] += 1;
    console.log("\nMapped lesson counts per section:");
    sections.forEach((s, i) => console.log(`  ${s.title}: ${counts[i]}`));
  }

  const inspection = await inspectLearnDashCourse(target.id);
  const proposed = transformLearnDashCurriculum(inspection);
  console.log(`\nProposed AIGS sections (${proposed.sections.length}):`);
  for (const sec of proposed.sections) {
    console.log(`  ${sec.title} — ${sec.items.length} items (source=${sec.source.type})`);
  }
  console.log(`\nWarnings:`);
  for (const w of inspection.warnings.filter((x) => x.code === "NO_SECTION_HEADINGS" || x.code === "EMPTY_COURSE")) {
    console.log(`  [${w.code}] ${w.message}`);
  }
  if (!inspection.warnings.some((x) => x.code === "NO_SECTION_HEADINGS")) {
    console.log("  (no NO_SECTION_HEADINGS warning)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Dump steps.sections for course 76822 and verify lesson bucketing.
 * Usage: npx tsx scripts/dump-steps-sections.ts --env local 76822
 */
import { loadCliEnv, parseEnvFlag, stripEnvArgs } from "./lib/load-cli-env.mjs";
import { isLearnDashConfigured } from "../lib/learndash/config";
import { getLearnDashCourseSteps } from "../lib/learndash/api/courses";
import { parseLearnDashCourseSteps } from "../lib/learndash/parse-steps";
import {
  extractSectionsFromEntity,
  mapLessonIndexesToSectionIndexes,
  resolveSectionIndexByLessonIndex,
} from "../lib/learndash/parse-sections";
import { getLearnDashLessonSafe } from "../lib/learndash/api/content";
import { getRenderedText } from "../lib/learndash/types/common";
import { mapWithConcurrency } from "../lib/learndash/client";
import { getLearnDashConfig } from "../lib/learndash/config";

async function main() {
  const envName = parseEnvFlag(process.argv);
  loadCliEnv(envName);
  const args = stripEnvArgs(process.argv.slice(2).filter((a) => a !== "--"));
  const courseId = Number(args.find((a) => /^\d+$/.test(a)) || 76822);

  if (!isLearnDashConfigured()) {
    console.error("LearnDash not configured");
    process.exit(1);
  }

  const rawSteps = await getLearnDashCourseSteps(courseId);
  const sectionsField = (rawSteps as { sections?: unknown }).sections;
  console.log("raw steps.sections:");
  console.log(JSON.stringify(sectionsField, null, 2));

  const headings = extractSectionsFromEntity(rawSteps);
  const { roots } = parseLearnDashCourseSteps(rawSteps);
  const lessonRoots = roots.filter((r) => r.type === "lesson");
  console.log(`\nlesson roots: ${lessonRoots.length}`);
  console.log(`headings: ${headings.length}`);

  const expected = [7, 3, 2, 2, 1, 1, 1];

  const absOwners = mapLessonIndexesToSectionIndexes(lessonRoots.length, headings);
  const absCounts = Array.from({ length: headings.length }, () => 0);
  absOwners.forEach((i) => absCounts[i]++);

  const lessonIdxOwners = lessonRoots.map((_, i) =>
    resolveSectionIndexByLessonIndex(i + 1, headings)
  );
  const lessonIdxCounts = Array.from({ length: headings.length }, () => 0);
  lessonIdxOwners.forEach((i) => lessonIdxCounts[i]++);

  console.log("\nAbsolute-slot mapper counts:", absCounts.join(","), "expected", expected.join(","));
  console.log("Lesson-index mapper counts:", lessonIdxCounts.join(","), "expected", expected.join(","));

  // If sections include steps, use membership
  const withSteps = headings.some((h) => (h.stepIds?.length ?? 0) > 0);
  console.log("has stepIds:", withSteps);
  if (withSteps) {
    const owners = mapLessonIndexesToSectionIndexes(
      lessonRoots.length,
      headings,
      lessonRoots.map((r) => r.id)
    );
    const counts = Array.from({ length: headings.length }, () => 0);
    owners.forEach((i) => counts[i]++);
    console.log("stepIds mapper counts:", counts.join(","));
  }

  const config = getLearnDashConfig();
  const lessons = await mapWithConcurrency(lessonRoots.map((r) => r.id), config.concurrency, (id) =>
    getLearnDashLessonSafe(id)
  );

  const bestOwners =
    withSteps
      ? mapLessonIndexesToSectionIndexes(
          lessonRoots.length,
          headings,
          lessonRoots.map((r) => r.id)
        )
      : lessonIdxCounts.join(",") === expected.join(",")
        ? lessonIdxOwners
        : absOwners;

  console.log("\n=== Builder-style outline (using best mapper) ===");
  for (let s = 0; s < headings.length; s++) {
    console.log(`\n${headings[s].title} (order=${headings[s].order})`);
    lessonRoots.forEach((root, i) => {
      if (bestOwners[i] !== s) return;
      const title = getRenderedText(lessons[i]?.title) || `(lesson ${root.id})`;
      console.log(`  - ${title}`);
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

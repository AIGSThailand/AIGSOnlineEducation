import assert from "node:assert/strict";
import { getLearningResume } from "../features/player/resume";
import type { CoursePlayerData, PlayerStep } from "../features/player/types";

const steps: PlayerStep[] = ["intro", "lesson", "quiz"].map((key) => ({
  key,
  kind: key === "quiz" ? "quiz" : "lesson",
  contentId: key,
  stepId: key,
  sectionId: "section",
  title: key,
  href: `/learn/${key}`,
  nested: false,
}));
const player: CoursePlayerData = {
  courseId: "course",
  courseTitle: "Course",
  progressionType: "linear",
  sections: [],
  flatSteps: steps,
  completedKeys: [],
};

assert.equal(getLearningResume(player).next?.key, "intro");
const partial = getLearningResume({ ...player, completedKeys: ["intro", "removed-step"] });
assert.equal(partial.next?.key, "lesson", "Resume the first accessible incomplete step");
assert.equal(partial.completed, 1, "Removed content must not inflate progress");
assert.equal(partial.percent, 33);
assert.equal(partial.finished, false);
assert.equal(
  getLearningResume({ ...player, progressionType: "free_form", completedKeys: ["lesson"] }).next
    ?.key,
  "intro",
  "Free-form courses resume the first unfinished step"
);
const finished = getLearningResume({ ...player, completedKeys: steps.map((step) => step.key) });
assert.equal(finished.finished, true);
assert.equal(finished.percent, 100);
assert.equal(finished.next?.key, "intro", "Completed courses offer review from the beginning");
const empty = getLearningResume({ ...player, flatSteps: [] });
assert.equal(empty.next, null);
assert.equal(empty.percent, 0);
assert.equal(empty.finished, false);
console.log("Learning resume checks passed.");

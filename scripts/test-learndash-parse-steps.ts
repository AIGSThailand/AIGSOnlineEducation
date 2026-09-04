/**
 * Unit checks for Course Steps parsing (no network).
 * Run: npm run test:learndash-parse
 */
import { parseLearnDashCourseSteps, collectStepIds } from "../lib/learndash/parse-steps";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// Shape from .ld / classic ld_course_steps meta
const classic = {
  steps: {
    h: {
      "sfwd-lessons": {
        "17750": {
          "sfwd-topic": {
            "17751": { "sfwd-quiz": [] },
            "17752": { "sfwd-quiz": { "17753": [] } },
          },
          "sfwd-quiz": [],
        },
        "17760": {
          "sfwd-topic": {
            "17761": { "sfwd-quiz": [] },
            "17762": { "sfwd-quiz": [] },
          },
          "sfwd-quiz": [],
        },
      },
      "sfwd-quiz": {
        "17800": [],
      },
    },
  },
};

const { roots, warnings } = parseLearnDashCourseSteps(classic);
assert(warnings.length === 0, `unexpected warnings: ${warnings.join("; ")}`);
assert(roots.length === 3, `expected 3 roots, got ${roots.length}`);
assert(roots[0].id === 17750 && roots[0].type === "lesson", "first root lesson 17750");
assert(roots[0].children.filter((c: { type: string }) => c.type === "topic").length === 2, "two topics under first lesson");
assert(roots[2].id === 17800 && roots[2].type === "quiz", "course-level quiz");

const ids = collectStepIds(roots);
assert(ids.lessonIds.length === 2, "2 lessons");
assert(ids.topicIds.length === 4, "4 topics");
assert(ids.quizIds.includes(17753) && ids.quizIds.includes(17800), "nested + course quizzes");

// Empty lesson topics
const noTopics = {
  "sfwd-lessons": {
    "100": { "sfwd-topic": [], "sfwd-quiz": [] },
  },
};
const parsedEmpty = parseLearnDashCourseSteps(noTopics);
assert(parsedEmpty.roots[0].children.length === 0, "empty topic arrays produce no children");

// Array shape
const asArray = [
  {
    id: 1,
    type: "sfwd-lessons",
    children: [{ id: 2, type: "sfwd-topic", children: [] }],
  },
];
const parsedArray = parseLearnDashCourseSteps(asArray);
assert(parsedArray.roots[0].id === 1 && parsedArray.roots[0].children[0].id === 2, "array shape");

console.log("test:learndash-parse — ok");

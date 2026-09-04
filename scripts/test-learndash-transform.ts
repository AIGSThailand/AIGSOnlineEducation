/**
 * Offline checks for Phase 2 curriculum transform (flat-lessons / quiz shells).
 * Run: npm run test:learndash-transform
 */
import { transformLearnDashCurriculum } from "../features/migration/learndash/transform-curriculum";
import { detectMappingPolicy, isQuizShellLesson } from "../features/migration/learndash/mapping-policy";
import type { LearnDashCourseInspection } from "../features/migration/learndash/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const flatInspection = {
  courseId: 26475,
  course: {
    id: 26475,
    slug: "ruby-sapphire-essentials",
    status: "publish",
    link: "https://example.com/courses/ruby",
    title: { rendered: "Ruby &#038; Sapphire Essentials" },
    content: { rendered: "<p>Intro</p>" },
    excerpt: { rendered: "" },
  },
  rawSteps: {},
  hierarchy: [
    {
      id: 1,
      type: "lesson",
      sourceType: "sfwd-lessons",
      children: [],
    },
    {
      id: 2,
      type: "lesson",
      sourceType: "sfwd-lessons",
      children: [{ id: 10, type: "quiz", sourceType: "sfwd-quiz", children: [] }],
    },
    {
      id: 3,
      type: "lesson",
      sourceType: "sfwd-lessons",
      children: [
        { id: 11, type: "quiz", sourceType: "sfwd-quiz", children: [] },
        { id: 12, type: "quiz", sourceType: "sfwd-quiz", children: [] },
      ],
    },
    {
      id: 99,
      type: "quiz",
      sourceType: "sfwd-quiz",
      children: [],
    },
  ],
  entities: {
    lessons: [
      { id: 1, slug: "intro", status: "publish", title: { rendered: "Introduction" }, content: { rendered: "<p>A</p>" }, excerpt: { rendered: "" } },
      { id: 2, slug: "quiz", status: "publish", title: { rendered: "Quiz" }, content: { rendered: "" }, excerpt: { rendered: "" } },
      { id: 3, slug: "module-quiz", status: "publish", title: { rendered: "Module Check" }, content: { rendered: "<p>B</p>" }, excerpt: { rendered: "" } },
    ],
    topics: [],
    quizzes: [
      { id: 10, slug: "q10", status: "publish", title: { rendered: "Quiz A" } },
      { id: 11, slug: "q11", status: "publish", title: { rendered: "Quiz B" } },
      { id: 12, slug: "q12", status: "publish", title: { rendered: "Quiz C" } },
      { id: 99, slug: "final", status: "publish", title: { rendered: "Final Exam" } },
    ],
  },
  counts: { lessons: 3, topics: 0, quizzes: 4, unknown: 0 },
  warnings: [],
} as unknown as LearnDashCourseInspection;

assert(detectMappingPolicy(flatInspection) === "flat-lessons", "auto policy should be flat-lessons");
assert(isQuizShellLesson("Quiz", false, 1) === true, "Quiz shell detection");
assert(isQuizShellLesson("Module Check", false, 2) === false, "non-shell lesson");

const proposed = transformLearnDashCurriculum(flatInspection);
assert(proposed.policy === "flat-lessons", "policy");
assert(proposed.course.title === "Ruby & Sapphire Essentials", "entity decode");
assert(proposed.summary.collapsedQuizShells === 1, `collapsed shells got ${proposed.summary.collapsedQuizShells}`);
assert(proposed.summary.lessons === 2, `lessons got ${proposed.summary.lessons}`);
assert(proposed.summary.quizzes === 3, `quizzes got ${proposed.summary.quizzes}`);
assert(proposed.summary.exams === 1, `exams got ${proposed.summary.exams}`);
assert(proposed.sections.length === 1, "one synthetic section");

const types = proposed.sections[0].items.map((i) => i.type);
assert(types.includes("exam"), "final exam mapped");
assert(!proposed.sections[0].items.some((i) => i.title === "Quiz" && i.type === "lesson"), "shell not kept as lesson");

console.log("test:learndash-transform OK");

/**
 * Offline checks for Phase 2 curriculum transform (flat-lessons / quiz shells / sections).
 * Run: npm run test:learndash-transform
 */
import { transformLearnDashCurriculum } from "../features/migration/learndash/transform-curriculum";
import { detectMappingPolicy, isQuizShellLesson } from "../features/migration/learndash/mapping-policy";
import {
  mapLessonIndexesToSectionIndexes,
  parseLearnDashCourseSections,
} from "../lib/learndash/parse-sections";
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
  sectionHeadings: [],
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
  counts: {
    lessons: 3,
    topics: 0,
    quizzes: 4,
    sectionHeadings: 0,
    unknownSteps: 0,
    missingLessons: 0,
    missingTopics: 0,
    missingQuizzes: 0,
  },
  warnings: [],
  inspectedAt: new Date().toISOString(),
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
assert(proposed.sections[0].title === "Course Content", "synthetic title");

const types = proposed.sections[0].items.map((i) => i.type);
assert(types.includes("exam"), "final exam mapped");
assert(!proposed.sections[0].items.some((i) => i.title === "Quiz" && i.type === "lesson"), "shell not kept as lesson");

// --- Section headings (jewelry-style: 第一课 / 第二课 / 第三课) ---
const parsed = parseLearnDashCourseSections([
  { order: 1, post_title: "第一课", type: "section-heading", ID: 101 },
  { order: 8, post_title: "第二课", type: "section-heading", ID: 102 },
  { order: 12, post_title: "第三课", type: "section-heading", ID: 103 },
]);
assert(parsed.length === 3, "parsed 3 headings");
assert(parsed[0].title === "第一课", "first heading title");

// 9 lessons + 3 headings → slots: H L L L L L L H L L L H L L
// lessons 0-5 → sec0, 6-8 → sec1, 9-10 would be sec2 — use 9 lessons:
// pos: 1H 2-7 L(6) 8H 9-11 L(3) 12H → only 9 lessons so after 12H none left; need 11 lessons for 6+3+2
const owners9 = mapLessonIndexesToSectionIndexes(9, parsed);
assert(owners9.length === 9, "9 owners");
assert(owners9.slice(0, 6).every((x) => x === 0), `first 6 in sec0 got ${owners9.slice(0, 6)}`);
assert(owners9.slice(6, 9).every((x) => x === 1), `next 3 in sec1 got ${owners9.slice(6, 9)}`);

const owners11 = mapLessonIndexesToSectionIndexes(11, parsed);
assert(owners11.slice(9, 11).every((x) => x === 2), `last 2 in sec2 got ${owners11.slice(9, 11)}`);

const jewelryInspection = {
  ...flatInspection,
  courseId: 99999,
  course: {
    ...flatInspection.course,
    id: 99999,
    title: { rendered: "Jewelry Drawing" },
    slug: "jewelry",
  },
  sectionHeadings: parsed,
  hierarchy: Array.from({ length: 11 }, (_, i) => ({
    id: i + 1,
    type: "lesson" as const,
    sourceType: "sfwd-lessons",
    children: [],
  })),
  entities: {
    lessons: Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      slug: `l-${i + 1}`,
      status: "publish",
      title: { rendered: `Lesson ${i + 1}` },
      content: { rendered: "" },
      excerpt: { rendered: "" },
    })),
    topics: [],
    quizzes: [],
  },
  counts: {
    lessons: 11,
    topics: 0,
    quizzes: 0,
    sectionHeadings: 3,
    unknownSteps: 0,
    missingLessons: 0,
    missingTopics: 0,
    missingQuizzes: 0,
  },
} as unknown as LearnDashCourseInspection;

const jewelry = transformLearnDashCurriculum(jewelryInspection);
assert(jewelry.sections.length === 3, `jewelry sections got ${jewelry.sections.length}`);
assert(jewelry.sections[0].title === "第一课", "sec0 title");
assert(jewelry.sections[1].title === "第二课", "sec1 title");
assert(jewelry.sections[2].title === "第三课", "sec2 title");
assert(jewelry.sections[0].items.length === 6, `sec0 items got ${jewelry.sections[0].items.length}`);
assert(jewelry.sections[1].items.length === 3, `sec1 items got ${jewelry.sections[1].items.length}`);
assert(jewelry.sections[2].items.length === 2, `sec2 items got ${jewelry.sections[2].items.length}`);
assert(jewelry.sections[0].source.type === "section-heading", "source type");

// stepIds membership takes priority
const withSteps = parseLearnDashCourseSections([
  { order: 1, post_title: "A", type: "section-heading", steps: [10, 11] },
  { order: 2, post_title: "B", type: "section-heading", steps: [12] },
]);
const bySteps = mapLessonIndexesToSectionIndexes(3, withSteps, [10, 12, 11]);
assert(bySteps[0] === 0 && bySteps[1] === 1 && bySteps[2] === 0, `stepIds map got ${bySteps}`);

console.log("test:learndash-transform OK");

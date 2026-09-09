import { getRenderedText } from "@/lib/learndash/types/common";
import { slugifyTitle } from "@/features/courses/builder/ordering";
import { mapLessonIndexesToSectionIndexes } from "@/lib/learndash/parse-sections";
import type { LearnDashSectionHeading } from "@/lib/learndash/types/section";
import { detectMappingPolicy, isQuizShellLesson } from "./mapping-policy";
import { transformLearnDashCourse } from "./transform-course";
import { decodeHtmlEntities, mapWpStatusToContentStatus } from "./html";
import type { LearnDashCourseInspection } from "./types";
import type { LearnDashStepNode } from "@/lib/learndash/types/course-step";
import type {
  MappingPolicyId,
  ProposedAigsCurriculum,
  ProposedCurriculumItem,
  ProposedSection,
} from "./proposed-types";
import type { LearnDashLesson, LearnDashQuiz, LearnDashTopic } from "@/lib/learndash/types/entities";

function titleOf(
  entity: LearnDashLesson | LearnDashTopic | LearnDashQuiz | undefined,
  fallback: string
): string {
  return decodeHtmlEntities(getRenderedText(entity?.title) || fallback);
}

function contentOf(entity: LearnDashLesson | LearnDashTopic | undefined): string | null {
  const html = getRenderedText(entity?.content);
  return html || null;
}

function excerptOf(entity: LearnDashLesson | LearnDashTopic | undefined): string | null {
  const html = getRenderedText(entity?.excerpt);
  return html || null;
}

function emptySectionsFromHeadings(headings: LearnDashSectionHeading[]): ProposedSection[] {
  return headings.map((h, position) => ({
    title: h.title,
    position,
    source: {
      type: "section-heading" as const,
      id: h.wordpressSectionId,
    },
    items: [] as ProposedCurriculumItem[],
  }));
}

function bucketItemsIntoSections(
  headings: LearnDashSectionHeading[],
  lessonOwners: number[],
  lessonItems: ProposedCurriculumItem[][],
  trailingExams: ProposedCurriculumItem[],
  notes: string[]
): ProposedSection[] {
  if (headings.length === 0) {
    const items = lessonItems.flat();
    for (const exam of trailingExams) items.push(exam);
    return [
      {
        title: "Course Content",
        position: 0,
        source: { type: "synthetic", id: null },
        items: items.map((item, position) => ({ ...item, position })),
      },
    ];
  }

  const sections = emptySectionsFromHeadings(headings);
  for (let i = 0; i < lessonItems.length; i++) {
    const sectionIdx = Math.min(Math.max(0, lessonOwners[i] ?? 0), sections.length - 1);
    sections[sectionIdx].items.push(...lessonItems[i]);
  }

  if (trailingExams.length > 0) {
    const last = sections[sections.length - 1];
    last.items.push(...trailingExams);
    notes.push(
      `Placed ${trailingExams.length} course-level exam(s) in last section "${last.title}".`
    );
  }

  // Drop empty sections only if every section would be empty (keep structure otherwise)
  const nonEmpty = sections.filter((s) => s.items.length > 0);
  const kept = nonEmpty.length > 0 ? nonEmpty : sections;

  return kept.map((section, position) => ({
    ...section,
    position,
    items: section.items.map((item, itemPos) => ({ ...item, position: itemPos })),
  }));
}

/**
 * Pure curriculum transform from Phase 1 inspection → proposed AIGS structure.
 */
export function transformLearnDashCurriculum(
  inspection: LearnDashCourseInspection,
  policyOverride?: MappingPolicyId
): ProposedAigsCurriculum {
  const policy = policyOverride ?? detectMappingPolicy(inspection);
  const course = transformLearnDashCourse(inspection);
  const notes: string[] = [];
  const headings = inspection.sectionHeadings ?? [];

  const lessonById = new Map(inspection.entities.lessons.map((l) => [l.id, l]));
  const topicById = new Map(inspection.entities.topics.map((t) => [t.id, t]));
  const quizById = new Map(inspection.entities.quizzes.map((q) => [q.id, q]));

  let collapsedQuizShells = 0;

  if (policy === "flat-lessons") {
    notes.push(
      "Policy flat-lessons: LD Lesson → AIGS lesson; nested quizzes → quiz items; no topics in source."
    );
    if (headings.length > 0) {
      notes.push(
        `Using ${headings.length} LearnDash section heading(s): ${headings.map((h) => h.title).join(", ")}.`
      );
    } else {
      notes.push("No course_sections headings — using synthetic section \"Course Content\".");
    }

    const lessonRoots = inspection.hierarchy.filter((r) => r.type === "lesson");
    const lessonWpIds = lessonRoots.map((r) => r.id);
    const lessonOwners = mapLessonIndexesToSectionIndexes(lessonRoots.length, headings, lessonWpIds);

    const lessonItemGroups: ProposedCurriculumItem[][] = [];
    const trailingExams: ProposedCurriculumItem[] = [];
    let positionCounter = 0;

    const makeQuizItem = (
      quizId: number,
      parentLessonSourceId: number | undefined,
      asExam: boolean
    ): ProposedCurriculumItem => {
      const quiz = quizById.get(quizId);
      const title = titleOf(quiz, `Quiz ${quizId}`);
      return {
        type: asExam ? "exam" : "quiz",
        title,
        slug: `${slugifyTitle(title) || "quiz"}-${quizId}`,
        position: positionCounter++,
        contentHtml: null,
        excerpt: null,
        status: mapWpStatusToContentStatus(quiz?.status),
        source: { type: "sfwd-quiz", id: quizId },
        parentLessonSourceId,
      };
    };

    for (const root of inspection.hierarchy) {
      if (root.type === "quiz") {
        trailingExams.push(makeQuizItem(root.id, undefined, true));
        notes.push(`Course-level quiz ${root.id} mapped as exam.`);
        continue;
      }

      if (root.type !== "lesson") {
        notes.push(`Skipped unsupported root step ${root.sourceType} (${root.id}).`);
        continue;
      }

      const group: ProposedCurriculumItem[] = [];
      const lesson = lessonById.get(root.id);
      const lessonTitle = titleOf(lesson, `Lesson ${root.id}`);
      const topics = root.children.filter((c) => c.type === "topic");
      const quizzes = root.children.filter((c) => c.type === "quiz");

      if (isQuizShellLesson(lessonTitle, topics.length > 0, quizzes.length)) {
        collapsedQuizShells += 1;
        for (const q of quizzes) {
          group.push(makeQuizItem(q.id, root.id, false));
        }
        lessonItemGroups.push(group);
        continue;
      }

      group.push({
        type: "lesson",
        title: lessonTitle,
        slug: `${(lesson?.slug || slugifyTitle(lessonTitle) || "lesson").replace(/\/$/, "")}-${root.id}`,
        position: positionCounter++,
        contentHtml: contentOf(lesson),
        excerpt: excerptOf(lesson),
        status: mapWpStatusToContentStatus(lesson?.status),
        source: { type: "sfwd-lessons", id: root.id },
      });

      for (const q of quizzes) {
        group.push(makeQuizItem(q.id, root.id, false));
      }

      for (const t of topics) {
        notes.push(
          `Unexpected topic ${t.id} under flat-lessons policy — ignored (use topics-as-lessons).`
        );
      }

      lessonItemGroups.push(group);
    }

    const sections = bucketItemsIntoSections(
      headings,
      lessonOwners,
      lessonItemGroups,
      trailingExams,
      notes
    );

    return summarize(policy, course, sections, collapsedQuizShells, notes);
  }

  // topics-as-lessons
  notes.push(
    "Policy topics-as-lessons: LD Lesson → content group; LD Topic → AIGS lesson; quizzes nest in section."
  );

  const lessonRoots = inspection.hierarchy.filter((r) => r.type === "lesson");
  const useHeadings = headings.length > 0;

  if (useHeadings) {
    notes.push(
      `Using ${headings.length} LearnDash section heading(s) as AIGS sections (LD lessons grouped under headings).`
    );
  } else {
    notes.push("No course_sections headings — each LD lesson becomes an AIGS section.");
  }

  const lessonOwners = useHeadings
    ? mapLessonIndexesToSectionIndexes(
        lessonRoots.length,
        headings,
        lessonRoots.map((r) => r.id)
      )
    : lessonRoots.map((_, i) => i);

  type GroupAcc = { title: string; source: ProposedSection["source"]; items: ProposedCurriculumItem[] };
  const groups: GroupAcc[] = useHeadings
    ? headings.map((h) => ({
        title: h.title,
        source: { type: "section-heading" as const, id: h.wordpressSectionId },
        items: [],
      }))
    : [];

  let lessonRootIdx = 0;
  const orphanExamSections: ProposedSection[] = [];

  for (const root of inspection.hierarchy) {
    if (root.type === "quiz") {
      const quiz = quizById.get(root.id);
      const title = titleOf(quiz, `Quiz ${root.id}`);
      orphanExamSections.push({
        title: "Examinations",
        position: 0,
        source: { type: "synthetic", id: null },
        items: [
          {
            type: "exam",
            title,
            slug: `${slugifyTitle(title) || "exam"}-${root.id}`,
            position: 0,
            contentHtml: null,
            excerpt: null,
            status: mapWpStatusToContentStatus(quiz?.status),
            source: { type: "sfwd-quiz", id: root.id },
          },
        ],
      });
      continue;
    }

    if (root.type !== "lesson") continue;

    const ldLesson = lessonById.get(root.id);
    const sectionTitle = titleOf(ldLesson, `Lesson ${root.id}`);
    const topics = root.children.filter((c) => c.type === "topic");
    const quizzes = root.children.filter((c) => c.type === "quiz");
    const items: ProposedCurriculumItem[] = [];
    let itemPos = 0;

    if (topics.length === 0) {
      items.push({
        type: "lesson",
        title: sectionTitle,
        slug: `${(ldLesson?.slug || slugifyTitle(sectionTitle) || "lesson").replace(/\/$/, "")}-${root.id}`,
        position: itemPos++,
        contentHtml: contentOf(ldLesson),
        excerpt: excerptOf(ldLesson),
        status: mapWpStatusToContentStatus(ldLesson?.status),
        source: { type: "sfwd-lessons", id: root.id },
      });
      notes.push(`LD lesson ${root.id} had no topics — used lesson content as sole section lesson.`);
    } else {
      for (const t of topics) {
        const topic = topicById.get(t.id);
        const topicTitle = titleOf(topic, `Topic ${t.id}`);
        items.push({
          type: "lesson",
          title: topicTitle,
          slug: `${(topic?.slug || slugifyTitle(topicTitle) || "topic").replace(/\/$/, "")}-${t.id}`,
          position: itemPos++,
          contentHtml: contentOf(topic),
          excerpt: excerptOf(topic),
          status: mapWpStatusToContentStatus(topic?.status),
          source: { type: "sfwd-topic", id: t.id },
        });
        for (const q of t.children.filter((c: LearnDashStepNode) => c.type === "quiz")) {
          const quiz = quizById.get(q.id);
          const qTitle = titleOf(quiz, `Quiz ${q.id}`);
          items.push({
            type: "quiz",
            title: qTitle,
            slug: `${slugifyTitle(qTitle) || "quiz"}-${q.id}`,
            position: itemPos++,
            contentHtml: null,
            excerpt: null,
            status: mapWpStatusToContentStatus(quiz?.status),
            source: { type: "sfwd-quiz", id: q.id },
            parentLessonSourceId: root.id,
          });
        }
      }
    }

    for (const q of quizzes) {
      const quiz = quizById.get(q.id);
      const qTitle = titleOf(quiz, `Quiz ${q.id}`);
      items.push({
        type: "quiz",
        title: qTitle,
        slug: `${slugifyTitle(qTitle) || "quiz"}-${q.id}`,
        position: itemPos++,
        contentHtml: null,
        excerpt: null,
        status: mapWpStatusToContentStatus(quiz?.status),
        source: { type: "sfwd-quiz", id: q.id },
        parentLessonSourceId: root.id,
      });
    }

    if (useHeadings) {
      const sectionIdx = Math.min(
        Math.max(0, lessonOwners[lessonRootIdx] ?? 0),
        groups.length - 1
      );
      groups[sectionIdx].items.push(...items);
    } else {
      groups.push({
        title: sectionTitle,
        source: { type: "sfwd-lessons", id: root.id },
        items,
      });
    }
    lessonRootIdx += 1;
  }

  let sections: ProposedSection[] = groups
    .filter((g) => g.items.length > 0 || !useHeadings)
    .map((g, position) => ({
      title: g.title,
      position,
      source: g.source,
      items: g.items.map((item, itemPos) => ({ ...item, position: itemPos })),
    }));

  for (const examSec of orphanExamSections) {
    sections.push({ ...examSec, position: sections.length });
  }

  if (useHeadings && sections.length === 0) {
    sections = bucketItemsIntoSections(headings, [], [], [], notes);
  }

  return summarize(policy, course, sections, collapsedQuizShells, notes);
}

function summarize(
  policy: MappingPolicyId,
  course: ProposedAigsCurriculum["course"],
  sections: ProposedSection[],
  collapsedQuizShells: number,
  notes: string[]
): ProposedAigsCurriculum {
  let lessons = 0;
  let quizzes = 0;
  let exams = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.type === "lesson") lessons += 1;
      else if (item.type === "exam") exams += 1;
      else quizzes += 1;
    }
  }
  return {
    policy,
    course,
    sections,
    summary: {
      sections: sections.length,
      lessons,
      quizzes,
      exams,
      collapsedQuizShells,
    },
    notes,
  };
}

export function formatProposedCurriculumReport(proposed: ProposedAigsCurriculum): string {
  const lines: string[] = [
    `PROPOSED AIGS STRUCTURE (policy: ${proposed.policy})`,
    "",
    `Course: ${proposed.course.title}`,
    `Slug: ${proposed.course.slug}`,
    `Status: ${proposed.course.status}`,
    `WordPress ID: ${proposed.course.wordpressCourseId}`,
    "",
  ];

  for (const section of proposed.sections) {
    lines.push(`Section: ${section.title}`);
    for (const item of section.items) {
      const tag = item.type.toUpperCase();
      const src =
        item.source.id != null ? `${item.source.type}:${item.source.id}` : item.source.type;
      lines.push(`    [${tag}] ${item.title}  (${src})`);
    }
    lines.push("");
  }

  lines.push("SUMMARY");
  lines.push(`  Sections: ${proposed.summary.sections}`);
  lines.push(`  Lessons:  ${proposed.summary.lessons}`);
  lines.push(`  Quizzes:  ${proposed.summary.quizzes}`);
  lines.push(`  Exams:    ${proposed.summary.exams}`);
  lines.push(`  Collapsed quiz-shell lessons: ${proposed.summary.collapsedQuizShells}`);
  lines.push("");
  lines.push("NOTES");
  for (const note of proposed.notes) {
    lines.push(`  - ${note}`);
  }
  return lines.join("\n");
}

import { getLearnDashConfig } from "@/lib/learndash/config";
import { mapWithConcurrency } from "@/lib/learndash/client";
import { getLearnDashCourse, getLearnDashCourseSteps } from "@/lib/learndash/api/courses";
import {
  getLearnDashLessonSafe,
  getLearnDashQuizSafe,
  getLearnDashTopicSafe,
} from "@/lib/learndash/api/content";
import { collectStepIds, parseLearnDashCourseSteps } from "@/lib/learndash/parse-steps";
import { getRenderedText } from "@/lib/learndash/types/common";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { LearnDashStepNode } from "@/lib/learndash/types/course-step";
import type {
  InspectionWarning,
  LearnDashCourseInspection,
} from "./types";

function maxDepth(nodes: LearnDashStepNode[], depth = 1): number {
  if (nodes.length === 0) return depth - 1;
  return Math.max(...nodes.map((n) => maxDepth(n.children, depth + 1)));
}

function findDuplicateIds(roots: LearnDashStepNode[]): LearnDashEntityId[] {
  const seen = new Set<LearnDashEntityId>();
  const dupes = new Set<LearnDashEntityId>();
  const walk = (nodes: LearnDashStepNode[]) => {
    for (const node of nodes) {
      if (seen.has(node.id)) dupes.add(node.id);
      seen.add(node.id);
      walk(node.children);
    }
  };
  walk(roots);
  return Array.from(dupes);
}

function analyzeStructure(roots: LearnDashStepNode[]): InspectionWarning[] {
  const warnings: InspectionWarning[] = [];

  if (roots.length === 0) {
    warnings.push({ code: "EMPTY_COURSE", message: "Course has no steps in the builder tree." });
  }

  const depth = maxDepth(roots);
  if (depth > 4) {
    warnings.push({
      code: "UNEXPECTED_DEPTH",
      message: `Hierarchy depth is ${depth}; expected LearnDash Lesson → Topic → Quiz (≤3–4).`,
    });
  }

  for (const id of findDuplicateIds(roots)) {
    warnings.push({
      code: "DUPLICATE_STEP_ID",
      message: `Step ID ${id} appears more than once in the course tree.`,
      sourceId: id,
    });
  }

  for (const root of roots) {
    if (root.type === "quiz") {
      warnings.push({
        code: "ORPHAN_QUIZ",
        message: `Course-level quiz ${root.id} (no parent lesson/topic).`,
        sourceType: root.sourceType,
        sourceId: root.id,
      });
    }
    if (root.type === "lesson") {
      const hasTopic = root.children.some((c) => c.type === "topic");
      if (!hasTopic) {
        warnings.push({
          code: "LESSON_WITHOUT_TOPICS",
          message: `Lesson ${root.id} has no topics (may map to a single AIGS lesson or section).`,
          sourceType: root.sourceType,
          sourceId: root.id,
        });
      }
    }
    if (root.type === "unknown") {
      warnings.push({
        code: "UNSUPPORTED_STEP_TYPE",
        message: `Unsupported top-level step type "${root.sourceType}" (id ${root.id}).`,
        sourceType: root.sourceType,
        sourceId: root.id,
      });
    }
  }

  return warnings;
}

/**
 * Phase 1: read-only LearnDash course inspection.
 * Does NOT write to Supabase. Does NOT mutate WordPress.
 */
export async function inspectLearnDashCourse(
  courseId: LearnDashEntityId
): Promise<LearnDashCourseInspection> {
  const config = getLearnDashConfig();
  const course = await getLearnDashCourse(courseId);
  const rawSteps = await getLearnDashCourseSteps(courseId);
  const { roots, warnings: parseWarnings } = parseLearnDashCourseSteps(rawSteps);
  const collected = collectStepIds(roots);

  const warnings: InspectionWarning[] = [
    ...parseWarnings.map((message) => ({
      code: "PARSE_WARNING" as const,
      message,
    })),
    ...analyzeStructure(roots),
  ];

  for (const u of collected.unknown) {
    warnings.push({
      code: "UNSUPPORTED_STEP_TYPE",
      message: `Unsupported step type "${u.sourceType}" (id ${u.id}).`,
      sourceType: u.sourceType,
      sourceId: u.id,
    });
  }

  const [lessons, topics, quizzes] = await Promise.all([
    mapWithConcurrency(collected.lessonIds, config.concurrency, (id) => getLearnDashLessonSafe(id)),
    mapWithConcurrency(collected.topicIds, config.concurrency, (id) => getLearnDashTopicSafe(id)),
    mapWithConcurrency(collected.quizIds, config.concurrency, (id) => getLearnDashQuizSafe(id)),
  ]);

  const resolvedLessons = lessons.filter((x): x is NonNullable<typeof x> => x !== null);
  const resolvedTopics = topics.filter((x): x is NonNullable<typeof x> => x !== null);
  const resolvedQuizzes = quizzes.filter((x): x is NonNullable<typeof x> => x !== null);

  let missingLessons = 0;
  let missingTopics = 0;
  let missingQuizzes = 0;

  for (let i = 0; i < collected.lessonIds.length; i++) {
    if (!lessons[i]) {
      missingLessons += 1;
      warnings.push({
        code: "MISSING_REFERENCED_OBJECT",
        message: `Lesson ${collected.lessonIds[i]} referenced in steps but not found via API.`,
        sourceType: "sfwd-lessons",
        sourceId: collected.lessonIds[i],
      });
    }
  }
  for (let i = 0; i < collected.topicIds.length; i++) {
    if (!topics[i]) {
      missingTopics += 1;
      warnings.push({
        code: "MISSING_REFERENCED_OBJECT",
        message: `Topic ${collected.topicIds[i]} referenced in steps but not found via API.`,
        sourceType: "sfwd-topic",
        sourceId: collected.topicIds[i],
      });
    }
  }
  for (let i = 0; i < collected.quizIds.length; i++) {
    if (!quizzes[i]) {
      missingQuizzes += 1;
      warnings.push({
        code: "MISSING_REFERENCED_OBJECT",
        message: `Quiz ${collected.quizIds[i]} referenced in steps but not found via API.`,
        sourceType: "sfwd-quiz",
        sourceId: collected.quizIds[i],
      });
    }
  }

  return {
    courseId,
    course,
    rawSteps,
    hierarchy: roots,
    entities: {
      lessons: resolvedLessons,
      topics: resolvedTopics,
      quizzes: resolvedQuizzes,
    },
    counts: {
      lessons: resolvedLessons.length,
      topics: resolvedTopics.length,
      quizzes: resolvedQuizzes.length,
      unknownSteps: collected.unknown.length,
      missingLessons,
      missingTopics,
      missingQuizzes,
    },
    warnings,
    inspectedAt: new Date().toISOString(),
  };
}

export function formatCourseStructureReport(inspection: LearnDashCourseInspection): string {
  const title = getRenderedText(inspection.course.title) || `(Course ${inspection.courseId})`;
  const lessonById = new Map(inspection.entities.lessons.map((l) => [l.id, l]));
  const topicById = new Map(inspection.entities.topics.map((t) => [t.id, t]));
  const quizById = new Map(inspection.entities.quizzes.map((q) => [q.id, q]));

  const lines: string[] = [
    `Course: ${title}`,
    `WordPress ID: ${inspection.courseId}`,
    `Slug: ${inspection.course.slug || "(none)"}`,
    `Status: ${inspection.course.status || "(unknown)"}`,
    "",
    "LEARN DASH STRUCTURE (from /steps)",
    "",
  ];

  const labelFor = (node: LearnDashStepNode): string => {
    if (node.type === "lesson") {
      const entity = lessonById.get(node.id);
      return `LD Lesson: ${getRenderedText(entity?.title) || "(missing title)"} [${node.id}]`;
    }
    if (node.type === "topic") {
      const entity = topicById.get(node.id);
      return `LD Topic: ${getRenderedText(entity?.title) || "(missing title)"} [${node.id}]`;
    }
    if (node.type === "quiz") {
      const entity = quizById.get(node.id);
      return `LD Quiz: ${getRenderedText(entity?.title) || "(missing title)"} [${node.id}]`;
    }
    return `LD ${node.sourceType}: [${node.id}]`;
  };

  const walk = (nodes: LearnDashStepNode[], indent: string) => {
    for (const node of nodes) {
      lines.push(`${indent}${labelFor(node)}`);
      walk(node.children, `${indent}    `);
    }
  };

  if (inspection.hierarchy.length === 0) {
    lines.push("(empty)");
  } else {
    walk(inspection.hierarchy, "");
  }

  lines.push("");
  lines.push("COUNTS");
  lines.push(`  Lessons: ${inspection.counts.lessons}`);
  lines.push(`  Topics:  ${inspection.counts.topics}`);
  lines.push(`  Quizzes: ${inspection.counts.quizzes}`);
  lines.push(`  Unknown steps: ${inspection.counts.unknownSteps}`);
  lines.push(
    `  Missing refs: lessons=${inspection.counts.missingLessons}, topics=${inspection.counts.missingTopics}, quizzes=${inspection.counts.missingQuizzes}`
  );

  lines.push("");
  lines.push(`WARNINGS (${inspection.warnings.length})`);
  if (inspection.warnings.length === 0) {
    lines.push("  (none)");
  } else {
    for (const w of inspection.warnings) {
      lines.push(`  [${w.code}] ${w.message}`);
    }
  }

  lines.push("");
  lines.push(
    "NOTE: Mapping policy (LD Lesson→Section vs LD Topic→Lesson) is NOT applied yet — Phase 1 inspection only."
  );

  return lines.join("\n");
}

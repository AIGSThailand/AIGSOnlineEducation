import type { LearnDashCourseInspection } from "./types";
import type { MappingPolicyId } from "./proposed-types";

/**
 * Choose mapping from real /steps shape.
 * Course 26475: no topics → flat-lessons (LD Lesson → AIGS lesson).
 */
export function detectMappingPolicy(inspection: LearnDashCourseInspection): MappingPolicyId {
  if (inspection.counts.topics > 0) return "topics-as-lessons";
  return "flat-lessons";
}

/** Lesson shells titled "Quiz" that only wrap nested quizzes. */
export function isQuizShellLesson(title: string, hasTopics: boolean, quizChildCount: number): boolean {
  if (hasTopics) return false;
  if (quizChildCount === 0) return false;
  const normalized = title.trim().toLowerCase();
  return normalized === "quiz" || /^quiz\s*\d*/i.test(normalized);
}

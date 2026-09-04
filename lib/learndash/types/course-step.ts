import type { LearnDashEntityId } from "./common";

/**
 * Normalized step node after parsing the Course Steps endpoint.
 * LearnDash may return several shapes; we normalize into this tree.
 */
export type LearnDashStepType = "lesson" | "topic" | "quiz" | "unknown";

export type LearnDashStepNode = {
  id: LearnDashEntityId;
  type: LearnDashStepType;
  sourceType: string;
  children: LearnDashStepNode[];
};

/** Raw course steps payload (shape varies by LD version). */
export type LearnDashCourseStepsRaw = unknown;

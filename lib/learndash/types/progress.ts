import type { LearnDashEntityId } from "./common";

export type LearnDashProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | string;

export type LearnDashCourseProgressHeader = {
  course: LearnDashEntityId;
  last_step?: number | null;
  steps_total?: number;
  steps_completed?: number;
  date_started?: string;
  date_completed?: string;
  progress_status?: LearnDashProgressStatus;
  [key: string]: unknown;
};

export type LearnDashCourseProgressStep = {
  step: LearnDashEntityId;
  post_type: "sfwd-lessons" | "sfwd-topic" | "sfwd-quiz" | string;
  date_started?: string;
  date_completed?: string;
  step_status?: LearnDashProgressStatus;
  [key: string]: unknown;
};

export type ProgressStepKind = "lesson" | "topic" | "quiz" | "unknown";

export function progressStepKind(postType: string | undefined): ProgressStepKind {
  switch (postType) {
    case "sfwd-lessons":
      return "lesson";
    case "sfwd-topic":
      return "topic";
    case "sfwd-quiz":
      return "quiz";
    default:
      return "unknown";
  }
}

export function isProgressStepCompleted(step: LearnDashCourseProgressStep): boolean {
  return (step.step_status || "").toLowerCase() === "completed";
}

export function isCourseProgressCompleted(header: LearnDashCourseProgressHeader): boolean {
  return (header.progress_status || "").toLowerCase() === "completed";
}

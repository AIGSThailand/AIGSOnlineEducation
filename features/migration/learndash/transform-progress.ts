import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type {
  LearnDashCourseProgressHeader,
  LearnDashCourseProgressStep,
  ProgressStepKind,
} from "@/lib/learndash/types/progress";
import {
  isCourseProgressCompleted,
  isProgressStepCompleted,
  progressStepKind,
} from "@/lib/learndash/types/progress";

export type ProposedProgressStep = {
  wordpressUserId: LearnDashEntityId;
  wordpressCourseId: LearnDashEntityId;
  wordpressStepId: LearnDashEntityId;
  kind: ProgressStepKind;
  completed: boolean;
  completedAt: string | null;
  startedAt: string | null;
};

export type ProposedCourseProgress = {
  wordpressUserId: LearnDashEntityId;
  wordpressCourseId: LearnDashEntityId;
  progressStatus: string;
  courseCompleted: boolean;
  stepsTotal: number | null;
  stepsCompleted: number | null;
  dateStarted: string | null;
  dateCompleted: string | null;
  steps: ProposedProgressStep[];
};

export type ProposedProgressBatch = {
  courses: ProposedCourseProgress[];
  summary: {
    userCoursePairs: number;
    completedLessons: number;
    completedTopics: number;
    completedQuizzes: number;
    incompleteSteps: number;
    unknownStepTypes: number;
    courseMarkedComplete: number;
  };
  notes: string[];
};

function parseDate(raw: string | undefined | null): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function transformProgressSteps(
  wordpressUserId: LearnDashEntityId,
  wordpressCourseId: LearnDashEntityId,
  steps: LearnDashCourseProgressStep[]
): ProposedProgressStep[] {
  return steps.map((s) => ({
    wordpressUserId,
    wordpressCourseId,
    wordpressStepId: Number(s.step),
    kind: progressStepKind(s.post_type),
    completed: isProgressStepCompleted(s),
    completedAt: parseDate(s.date_completed),
    startedAt: parseDate(s.date_started),
  }));
}

export function transformUserCourseProgress(
  wordpressUserId: LearnDashEntityId,
  wordpressCourseId: LearnDashEntityId,
  header: LearnDashCourseProgressHeader | null,
  steps: LearnDashCourseProgressStep[]
): ProposedCourseProgress {
  const courseId = Number(header?.course || wordpressCourseId);
  const proposedSteps = transformProgressSteps(wordpressUserId, courseId, steps);

  return {
    wordpressUserId,
    wordpressCourseId: courseId,
    progressStatus: String(header?.progress_status || "unknown"),
    courseCompleted: header ? isCourseProgressCompleted(header) : false,
    stepsTotal: header?.steps_total ?? null,
    stepsCompleted: header?.steps_completed ?? null,
    dateStarted: parseDate(header?.date_started),
    dateCompleted: parseDate(header?.date_completed),
    steps: proposedSteps,
  };
}

export function aggregateProposedProgress(
  courses: ProposedCourseProgress[]
): ProposedProgressBatch {
  const notes: string[] = [];
  let completedLessons = 0;
  let completedTopics = 0;
  let completedQuizzes = 0;
  let incompleteSteps = 0;
  let unknownStepTypes = 0;
  let courseMarkedComplete = 0;

  for (const c of courses) {
    if (c.courseCompleted) courseMarkedComplete += 1;
    for (const s of c.steps) {
      if (s.kind === "unknown") unknownStepTypes += 1;
      if (!s.completed) {
        incompleteSteps += 1;
        continue;
      }
      if (s.kind === "lesson") completedLessons += 1;
      else if (s.kind === "topic") completedTopics += 1;
      else if (s.kind === "quiz") completedQuizzes += 1;
    }
  }

  if (unknownStepTypes > 0) {
    notes.push(`${unknownStepTypes} step(s) with unknown post_type — will be skipped on write.`);
  }

  return {
    courses,
    summary: {
      userCoursePairs: courses.length,
      completedLessons,
      completedTopics,
      completedQuizzes,
      incompleteSteps,
      unknownStepTypes,
      courseMarkedComplete,
    },
    notes,
  };
}

export function formatProgressReport(batch: ProposedProgressBatch): string {
  const s = batch.summary;
  const lines = [
    "=== LearnDash progress (proposed) ===",
    `user×course pairs:     ${s.userCoursePairs}`,
    `completed lessons:     ${s.completedLessons}`,
    `completed topics:      ${s.completedTopics}`,
    `completed quizzes:     ${s.completedQuizzes}`,
    `incomplete steps:      ${s.incompleteSteps}`,
    `unknown step types:    ${s.unknownStepTypes}`,
    `courses marked complete: ${s.courseMarkedComplete}`,
    "",
    "Writes: lesson_progress + step_progress (lessons), topic_progress + step_progress (topics), step_progress only (quizzes).",
    "Scope: enrolled users only.",
  ];
  if (batch.notes.length) {
    lines.push("", "--- Notes ---");
    for (const n of batch.notes) lines.push(`  • ${n}`);
  }
  return lines.join("\n");
}

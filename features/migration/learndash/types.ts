import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { LearnDashStepNode } from "@/lib/learndash/types/course-step";
import type { LearnDashCourse, LearnDashLesson, LearnDashQuiz, LearnDashTopic } from "@/lib/learndash/types/entities";

export type InspectionWarningCode =
  | "EMPTY_COURSE"
  | "UNSUPPORTED_STEP_TYPE"
  | "MISSING_REFERENCED_OBJECT"
  | "LESSON_WITHOUT_TOPICS"
  | "ORPHAN_QUIZ"
  | "UNEXPECTED_DEPTH"
  | "DUPLICATE_STEP_ID"
  | "PARSE_WARNING";

export type InspectionWarning = {
  code: InspectionWarningCode;
  message: string;
  sourceType?: string;
  sourceId?: LearnDashEntityId;
};

export type LearnDashCourseInspection = {
  courseId: LearnDashEntityId;
  course: LearnDashCourse;
  rawSteps: unknown;
  hierarchy: LearnDashStepNode[];
  entities: {
    lessons: LearnDashLesson[];
    topics: LearnDashTopic[];
    quizzes: LearnDashQuiz[];
  };
  counts: {
    lessons: number;
    topics: number;
    quizzes: number;
    unknownSteps: number;
    missingLessons: number;
    missingTopics: number;
    missingQuizzes: number;
  };
  warnings: InspectionWarning[];
  inspectedAt: string;
};

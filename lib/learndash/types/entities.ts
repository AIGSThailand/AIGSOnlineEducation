import type { LearnDashWpEntity } from "./common";
import type { LearnDashQuizSettings } from "./question";

export type LearnDashCourse = LearnDashWpEntity & {
  type?: "sfwd-courses" | string;
};

export type LearnDashLesson = LearnDashWpEntity & {
  type?: "sfwd-lessons" | string;
};

export type LearnDashTopic = LearnDashWpEntity & {
  type?: "sfwd-topic" | string;
};

export type LearnDashQuiz = LearnDashWpEntity &
  LearnDashQuizSettings & {
    type?: "sfwd-quiz" | string;
  };

export type {
  LearnDashQuestion,
  LearnDashProQuizAnswer,
  LearnDashProQuizQuestion,
  LearnDashQuizSettings,
} from "./question";

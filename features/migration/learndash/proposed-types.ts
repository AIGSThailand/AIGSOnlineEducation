import type { LearnDashEntityId } from "@/lib/learndash/types/common";

/** Intermediate AIGS curriculum proposal (no DB ids yet). */
export type ProposedItemType = "lesson" | "quiz" | "exam";

export type ProposedSourceRef = {
  type: "sfwd-lessons" | "sfwd-topic" | "sfwd-quiz" | "sfwd-courses" | "synthetic";
  id: LearnDashEntityId | null;
};

export type ProposedCurriculumItem = {
  type: ProposedItemType;
  title: string;
  slug: string;
  position: number;
  contentHtml: string | null;
  excerpt: string | null;
  status: "draft" | "published" | "archived";
  source: ProposedSourceRef;
  /** Parent LD lesson id when quiz is nested under a lesson shell. */
  parentLessonSourceId?: LearnDashEntityId;
};

export type ProposedSection = {
  title: string;
  position: number;
  source: ProposedSourceRef;
  items: ProposedCurriculumItem[];
};

export type ProposedCourse = {
  title: string;
  slug: string;
  descriptionHtml: string | null;
  excerpt: string | null;
  status: "draft" | "published" | "archived";
  wordpressCourseId: LearnDashEntityId;
  sourceUrl: string | null;
};

export type MappingPolicyId = "flat-lessons" | "topics-as-lessons";

export type ProposedAigsCurriculum = {
  policy: MappingPolicyId;
  course: ProposedCourse;
  sections: ProposedSection[];
  summary: {
    sections: number;
    lessons: number;
    quizzes: number;
    exams: number;
    collapsedQuizShells: number;
  };
  notes: string[];
};

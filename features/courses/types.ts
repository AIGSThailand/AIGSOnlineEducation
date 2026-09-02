import type { ContentStatus, CourseProgressionType, CourseStatus } from "@/types/database.types";

export type StructureItemType = "course" | "module" | "lesson" | "section" | "topic" | "quiz";

export interface CourseStructureLessonItem {
  kind: "lesson";
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  sortOrder: number;
  status: ContentStatus;
  hasProgress: boolean;
}

export interface CourseStructureModuleItem {
  kind: "module";
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: CourseStructureLessonItem[];
  /** Future: nested topics/quizzes under lessons */
  children?: CourseStructureItem[];
}

/** Extensible union — add SectionItem, TopicItem, QuizItem later without rewriting the tree. */
export type CourseStructureItem = CourseStructureModuleItem | CourseStructureLessonItem;

export interface CourseBuilderCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  excerpt: string | null;
  status: CourseStatus;
  progressionType: CourseProgressionType;
  thumbnailUrl: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  wordpressCourseId: number | null;
  createdAt: string;
  updatedAt: string;
  instructorIds: string[];
  enrollmentCount: number;
}

export interface CourseBuilderData {
  course: CourseBuilderCourse;
  structure: CourseStructureModuleItem[];
  instructors: InstructorOption[];
}

export interface InstructorOption {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export type BuilderPortal = "admin" | "instructor";

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  updatedAt: string;
  enrollmentCount: number;
  instructorNames: string[];
}

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

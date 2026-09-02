/**
 * Curriculum domain types for the Course Builder.
 *
 * Database mapping (Phase 1):
 * - course_sections  → Section (position = sort_order)
 * - course_steps     → ordered curriculum items (spec "course_items" layer)
 * - lessons / quizzes / topics → content referenced by course_steps
 *
 * Legacy Phase 1 `modules` shares UUIDs with course_sections (dual-write sync).
 */

import type { ContentStatus, CourseProgressionType, CourseStatus } from "@/types/database.types";

/** URL-safe builder selection (also used in ?type=&id= search params). */
export type CourseBuilderSelection =
  | { type: "course" }
  | { type: "section"; id: string }
  | { type: "lesson"; id: string; sectionId: string }
  | { type: "quiz"; id: string; sectionId: string }
  | { type: "exam"; id: string; sectionId: string };

export type CurriculumItemType = "lesson" | "quiz" | "assignment" | "exam" | "topic";

export interface CurriculumLessonItem {
  kind: "lesson";
  id: string;
  stepId: string | null;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
  status: ContentStatus;
  hasProgress: boolean;
}

export interface CurriculumQuizItem {
  kind: "quiz" | "exam";
  id: string;
  stepId: string;
  sectionId: string;
  title: string;
  slug: string;
  position: number;
  status: ContentStatus;
}

export type CurriculumItem = CurriculumLessonItem | CurriculumQuizItem;

export interface CurriculumSection {
  kind: "section";
  id: string;
  title: string;
  description: string | null;
  position: number;
  wordpressSectionId: number | null;
  items: CurriculumItem[];
}

export interface CourseBuilderPermissions {
  canPublish: boolean;
  canArchive: boolean;
  canEditCommerce: boolean;
  canEditMigration: boolean;
  canManageInstructors: boolean;
  canDeleteContent: boolean;
}

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

export interface InstructorOption {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/** Primary payload for <CourseBuilder initialData={...} /> */
export interface CourseBuilderPayload {
  course: CourseBuilderCourse;
  sections: CurriculumSection[];
  instructors: InstructorOption[];
  permissions: CourseBuilderPermissions;
  /** Which data source built the tree (for debugging migrated courses). */
  structureSource: "course_sections" | "modules_fallback";
}

export function parseBuilderSelectionFromSearchParams(
  params: Record<string, string | string[] | undefined>
): CourseBuilderSelection {
  const type = typeof params.type === "string" ? params.type : undefined;
  const id = typeof params.id === "string" ? params.id : undefined;
  const sectionId =
    typeof params.sectionId === "string"
      ? params.sectionId
      : typeof params.section === "string"
        ? params.section
        : undefined;

  if (!type || type === "course") return { type: "course" };
  if (!id) return { type: "course" };

  switch (type) {
    case "section":
      return { type: "section", id };
    case "lesson":
      return { type: "lesson", id, sectionId: sectionId ?? "" };
    case "quiz":
    case "exam":
      return { type: type as "quiz" | "exam", id, sectionId: sectionId ?? "" };
    default:
      return { type: "course" };
  }
}

export function builderSelectionToSearchParams(
  selection: CourseBuilderSelection
): URLSearchParams {
  const params = new URLSearchParams();
  if (selection.type === "course") return params;
  params.set("type", selection.type);
  params.set("id", selection.id);
  if ("sectionId" in selection && selection.sectionId) {
    params.set("sectionId", selection.sectionId);
  }
  return params;
}

/** @deprecated Use CurriculumSection — kept for incremental UI migration */
export type CourseStructureModuleItem = CurriculumSection & {
  kind: "section";
  /** @deprecated use items */
  lessons: CurriculumLessonItem[];
  sortOrder: number;
};

export type CourseBuilderData = CourseBuilderPayload & {
  /** @deprecated use sections */
  structure: CourseStructureModuleItem[];
};

export type SelectedItem = CourseBuilderSelection;

export type BuilderPortal = "admin" | "instructor";
export type SaveStatus = "idle" | "saving" | "saved" | "error" | "unsaved";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type StructureItemType = "course" | "section" | "module" | "lesson" | "quiz" | "exam" | "topic";

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  updatedAt: string;
  enrollmentCount: number;
  instructorNames: string[];
}

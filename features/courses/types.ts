/** @deprecated Import from @/features/curriculum/types */
export type {
  CourseBuilderSelection,
  CurriculumItemType,
  CurriculumLessonItem,
  CurriculumQuizItem,
  CurriculumItem,
  CurriculumSection,
  CourseBuilderPermissions,
  CourseBuilderCourse,
  InstructorOption,
  CourseBuilderPayload,
  CourseStructureModuleItem,
  CourseBuilderData,
  SelectedItem,
  BuilderPortal,
  SaveStatus,
  ActionResult,
  StructureItemType,
  CourseListItem,
} from "@/features/curriculum/types";

export {
  parseBuilderSelectionFromSearchParams,
  builderSelectionToSearchParams,
} from "@/features/curriculum/types";

/** @deprecated Use CurriculumLessonItem */
export type CourseStructureLessonItem = import("@/features/curriculum/types").CurriculumLessonItem;

/** @deprecated Use CurriculumSection */
export type CourseStructureItem =
  | import("@/features/curriculum/types").CurriculumSection
  | import("@/features/curriculum/types").CurriculumLessonItem;

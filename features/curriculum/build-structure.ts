import type {
  CurriculumItem,
  CurriculumLessonItem,
  CurriculumQuizItem,
  CurriculumSection,
  CourseBuilderPermissions,
} from "./types";
import type { ContentStatus } from "@/types/database.types";

type SectionRow = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  wordpress_section_id: number | null;
};

type StepRow = {
  id: string;
  course_id: string;
  step_type: "lesson" | "topic" | "quiz";
  lesson_id: string | null;
  quiz_id: string | null;
  section_id: string | null;
  sort_order: number;
};

type LessonRow = {
  id: string;
  module_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  status: ContentStatus | null;
};

type QuizRow = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
};

type ModuleRow = {
  id: string;
  title: string;
  sort_order: number;
};

export function buildPermissions(isAdmin: boolean): CourseBuilderPermissions {
  return {
    canPublish: isAdmin,
    canArchive: isAdmin,
    canEditCommerce: isAdmin,
    canEditMigration: isAdmin,
    canManageInstructors: isAdmin,
    canDeleteContent: true,
  };
}

export function sectionRowToCurriculumSection(section: SectionRow): CurriculumSection {
  return {
    kind: "section",
    id: section.id,
    title: section.title,
    description: section.description,
    position: section.sort_order,
    wordpressSectionId: section.wordpress_section_id,
    items: [],
  };
}

/**
 * Build hierarchical curriculum from course_sections + course_steps (LearnDash / Phase 2).
 */
export function buildSectionsFromSteps(
  sections: SectionRow[],
  steps: StepRow[],
  lessonsById: Map<string, LessonRow>,
  quizzesById: Map<string, QuizRow>,
  progressLessonIds: Set<string>
): CurriculumSection[] {
  const sectionMap = new Map<string, CurriculumSection>();
  for (const section of sections) {
    sectionMap.set(section.id, sectionRowToCurriculumSection(section));
  }

  const sortedSteps = [...steps].sort((a, b) => a.sort_order - b.sort_order);

  for (const step of sortedSteps) {
    const sectionId =
      step.section_id ??
      (step.lesson_id ? lessonsById.get(step.lesson_id)?.module_id : null) ??
      null;

    if (!sectionId || !sectionMap.has(sectionId)) continue;

    const section = sectionMap.get(sectionId)!;

    if (step.step_type === "lesson" && step.lesson_id) {
      const lesson = lessonsById.get(step.lesson_id);
      if (!lesson) continue;
      const item: CurriculumLessonItem = {
        kind: "lesson",
        id: lesson.id,
        stepId: step.id,
        sectionId,
        title: lesson.title,
        slug: lesson.slug,
        position: step.sort_order,
        status: lesson.status ?? "published",
        hasProgress: progressLessonIds.has(lesson.id),
      };
      section.items.push(item);
    } else if (step.step_type === "quiz" && step.quiz_id) {
      const quiz = quizzesById.get(step.quiz_id);
      if (!quiz) continue;
      const item: CurriculumQuizItem = {
        kind: "quiz",
        id: quiz.id,
        stepId: step.id,
        sectionId,
        title: quiz.title,
        slug: quiz.slug,
        position: step.sort_order,
        status: quiz.status,
      };
      section.items.push(item);
    }
  }

  for (const section of Array.from(sectionMap.values())) {
    section.items.sort((a, b) => a.position - b.position);
  }

  return Array.from(sectionMap.values()).sort((a, b) => a.position - b.position);
}

/**
 * Fallback for courses without course_sections rows — uses legacy modules + lessons.
 */
export function buildSectionsFromModules(
  modules: ModuleRow[],
  lessons: LessonRow[],
  progressLessonIds: Set<string>
): CurriculumSection[] {
  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const lesson of lessons) {
    if (!lesson.module_id) continue;
    const list = lessonsByModule.get(lesson.module_id) || [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  return modules
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((mod) => ({
      kind: "section" as const,
      id: mod.id,
      title: mod.title,
      description: null,
      position: mod.sort_order,
      wordpressSectionId: null,
      items: (lessonsByModule.get(mod.id) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(
          (lesson): CurriculumLessonItem => ({
            kind: "lesson",
            id: lesson.id,
            stepId: null,
            sectionId: mod.id,
            title: lesson.title,
            slug: lesson.slug,
            position: lesson.sort_order,
            status: lesson.status ?? "published",
            hasProgress: progressLessonIds.has(lesson.id),
          })
        ),
    }));
}

/** Legacy adapter for components still expecting `structure` + nested `lessons`. */
export function toLegacyStructure(sections: CurriculumSection[]) {
  return sections.map((section) => ({
    ...section,
    sortOrder: section.position,
    lessons: section.items
      .filter((i): i is CurriculumLessonItem => i.kind === "lesson")
      .map((lesson) => ({
        ...lesson,
        /** @deprecated use sectionId */
        moduleId: lesson.sectionId,
        sortOrder: lesson.position,
      })),
  }));
}

export function findLessonInSections(
  sections: CurriculumSection[],
  lessonId: string
): { lesson: CurriculumLessonItem; sectionId: string } | null {
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === "lesson" && item.id === lessonId) {
        return { lesson: item, sectionId: section.id };
      }
    }
  }
  return null;
}

export function countCurriculumItems(sections: CurriculumSection[]) {
  let lessons = 0;
  let quizzes = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === "lesson") lessons++;
      else quizzes++;
    }
  }
  return { sections: sections.length, lessons, quizzes };
}

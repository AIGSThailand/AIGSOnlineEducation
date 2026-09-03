import type { PlayerItem, PlayerSection, PlayerStep, StepRow } from "./types";

type LessonMeta = { id: string; title: string; module_id: string | null };
type QuizMeta = { id: string; title: string };
type SectionRow = { id: string; title: string; sort_order: number };

const UNSECTIONED_ID = "__unsectioned__";

export function playerStepKey(kind: PlayerStep["kind"], contentId: string, stepId: string | null) {
  return stepId ? `step:${stepId}` : `${kind}:${contentId}`;
}

function lessonHref(courseId: string, lessonId: string) {
  return `/courses/${courseId}/lessons/${lessonId}`;
}

function quizHref(courseId: string, quizId: string) {
  return `/courses/${courseId}/quizzes/${quizId}`;
}

function toLessonStep(
  courseId: string,
  step: StepRow,
  lesson: LessonMeta,
  sectionId: string,
  nested: boolean
): PlayerStep {
  return {
    key: playerStepKey("lesson", lesson.id, step.id),
    kind: "lesson",
    contentId: lesson.id,
    stepId: step.id,
    sectionId,
    title: lesson.title,
    href: lessonHref(courseId, lesson.id),
    nested,
  };
}

function toQuizStep(
  courseId: string,
  step: StepRow,
  quiz: QuizMeta,
  sectionId: string,
  nested: boolean
): PlayerStep {
  return {
    key: playerStepKey("quiz", quiz.id, step.id),
    kind: "quiz",
    contentId: quiz.id,
    stepId: step.id,
    sectionId,
    title: nested ? "Quiz" : quiz.title,
    href: `${quizHref(courseId, quiz.id)}?step=${step.id}`,
    nested,
  };
}

function parentToItem(
  courseId: string,
  step: StepRow,
  sectionId: string,
  lessonsById: Map<string, LessonMeta>,
  quizzesById: Map<string, QuizMeta>,
  childrenByParent: Map<string, StepRow[]>
): PlayerItem | null {
  let base: PlayerStep | null = null;

  if (step.step_type === "lesson" && step.lesson_id) {
    const lesson = lessonsById.get(step.lesson_id);
    if (!lesson) return null;
    base = toLessonStep(courseId, step, lesson, sectionId, false);
  } else if (step.step_type === "quiz" && step.quiz_id) {
    const quiz = quizzesById.get(step.quiz_id);
    if (!quiz) return null;
    base = toQuizStep(courseId, step, quiz, sectionId, false);
  }

  if (!base) return null;

  const childRows = (childrenByParent.get(step.id) || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const children: PlayerStep[] = [];
  for (const child of childRows) {
    if (child.step_type === "quiz" && child.quiz_id) {
      const quiz = quizzesById.get(child.quiz_id);
      if (quiz) children.push(toQuizStep(courseId, child, quiz, sectionId, true));
    }
  }

  return { ...base, children };
}

/**
 * Build LearnDash-style player tree: section → lessons, with nested quizzes after each lesson.
 */
export function buildPlayerFromSteps(
  courseId: string,
  sections: SectionRow[],
  steps: StepRow[],
  lessonsById: Map<string, LessonMeta>,
  quizzesById: Map<string, QuizMeta>
): { sections: PlayerSection[]; flatSteps: PlayerStep[] } {
  const parents = steps.filter((s) => !s.parent_step_id).sort((a, b) => a.sort_order - b.sort_order);
  const childrenByParent = new Map<string, StepRow[]>();
  for (const step of steps) {
    if (!step.parent_step_id) continue;
    const list = childrenByParent.get(step.parent_step_id) || [];
    list.push(step);
    childrenByParent.set(step.parent_step_id, list);
  }

  const orderedSections = [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const itemsBySection = new Map<string, PlayerItem[]>();
  for (const section of orderedSections) {
    itemsBySection.set(section.id, []);
  }
  const unsectioned: PlayerItem[] = [];

  for (const step of parents) {
    const sectionId =
      step.section_id ??
      (step.lesson_id ? lessonsById.get(step.lesson_id)?.module_id : null) ??
      null;
    const item = parentToItem(
      courseId,
      step,
      sectionId || UNSECTIONED_ID,
      lessonsById,
      quizzesById,
      childrenByParent
    );
    if (!item) continue;

    if (sectionId && itemsBySection.has(sectionId)) {
      itemsBySection.get(sectionId)!.push(item);
    } else {
      unsectioned.push(item);
    }
  }

  const tree: PlayerSection[] = orderedSections.map((section) => ({
    id: section.id,
    title: section.title,
    items: itemsBySection.get(section.id) || [],
  }));

  if (unsectioned.length > 0) {
    tree.push({
      id: UNSECTIONED_ID,
      title: "Course quizzes",
      items: unsectioned,
    });
  }

  const filtered = tree.filter((section) => section.items.length > 0);
  const flatSteps = flattenPlayerSections(filtered);
  return { sections: filtered, flatSteps };
}

export function buildPlayerFromModules(
  courseId: string,
  modules: SectionRow[],
  lessons: Array<LessonMeta & { sort_order: number }>
): { sections: PlayerSection[]; flatSteps: PlayerStep[] } {
  const lessonsByModule = new Map<string, Array<LessonMeta & { sort_order: number }>>();
  for (const lesson of lessons) {
    if (!lesson.module_id) continue;
    const list = lessonsByModule.get(lesson.module_id) || [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  const tree: PlayerSection[] = [...modules]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((mod) => ({
      id: mod.id,
      title: mod.title,
      items: (lessonsByModule.get(mod.id) || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((lesson) => {
          const step: PlayerStep = {
            key: playerStepKey("lesson", lesson.id, null),
            kind: "lesson",
            contentId: lesson.id,
            stepId: null,
            sectionId: mod.id,
            title: lesson.title,
            href: lessonHref(courseId, lesson.id),
            nested: false,
          };
          return { ...step, children: [] };
        }),
    }))
    .filter((section) => section.items.length > 0);

  return { sections: tree, flatSteps: flattenPlayerSections(tree) };
}

export function flattenPlayerSections(sections: PlayerSection[]): PlayerStep[] {
  const flat: PlayerStep[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      const { children, ...step } = item;
      flat.push(step);
      for (const child of children) {
        flat.push(child);
      }
    }
  }
  return flat;
}

export function findStepByContent(
  flatSteps: PlayerStep[],
  kind: PlayerStep["kind"],
  contentId: string
): PlayerStep | undefined {
  return flatSteps.find((s) => s.kind === kind && s.contentId === contentId);
}

export function adjacentSteps(flatSteps: PlayerStep[], currentKey: string) {
  const index = flatSteps.findIndex((s) => s.key === currentKey);
  return {
    index,
    prev: index > 0 ? flatSteps[index - 1] : null,
    next: index >= 0 && index < flatSteps.length - 1 ? flatSteps[index + 1] : null,
  };
}

/** Linear courses: only completed steps + the first incomplete step are unlocked. */
export function lockedStepKeys(
  flatSteps: PlayerStep[],
  completedKeys: Set<string>,
  linear: boolean,
  bypass: boolean
): Set<string> {
  const locked = new Set<string>();
  if (!linear || bypass) return locked;

  let unlockedNext = true;
  for (const step of flatSteps) {
    const done = completedKeys.has(step.key);
    if (done) continue;
    if (unlockedNext) {
      unlockedNext = false;
      continue;
    }
    locked.add(step.key);
  }
  return locked;
}

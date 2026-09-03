import type { SupabaseClient } from "@supabase/supabase-js";
import { syncLessonToStep, syncModuleToSection } from "@/features/courses/builder/sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export type CurriculumOrderSection = {
  sectionId: string;
  items: Array<{
    kind: "lesson" | "quiz" | "exam";
    id: string;
  }>;
};

const TEMP_SORT_BASE = 100_000;

/** Two-phase sort_order updates to satisfy unique constraints on course_sections. */
export async function persistSectionOrder(
  supabase: Db,
  courseId: string,
  orderedSectionIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedSectionIds.length; i++) {
    const id = orderedSectionIds[i];
    const { error } = await supabase
      .from("course_sections")
      .update({ sort_order: TEMP_SORT_BASE + i } as never)
      .eq("id", id)
      .eq("course_id", courseId);
    if (error) throw new Error(error.message);
  }

  for (let i = 0; i < orderedSectionIds.length; i++) {
    const id = orderedSectionIds[i];
    const { error: sectionErr } = await supabase
      .from("course_sections")
      .update({ sort_order: i } as never)
      .eq("id", id);
    if (sectionErr) throw new Error(sectionErr.message);

    const { error: moduleErr } = await supabase
      .from("modules")
      .update({ sort_order: i } as never)
      .eq("id", id);
    if (moduleErr) throw new Error(moduleErr.message);

    const { data: moduleRow } = await supabase
      .from("modules")
      .select("id, course_id, title, sort_order")
      .eq("id", id)
      .maybeSingle<{ id: string; course_id: string; title: string; sort_order: number }>();

    if (moduleRow) await syncModuleToSection(supabase, moduleRow);
  }
}

/** Persist curriculum item order — dual-writes lessons/modules and course_steps when present. */
export async function persistCurriculumOrder(
  supabase: Db,
  courseId: string,
  sections: CurriculumOrderSection[]
): Promise<void> {
  const { data: steps } = await supabase
    .from("course_steps")
    .select("id, lesson_id, quiz_id, step_type")
    .eq("course_id", courseId)
    .is("parent_step_id", null)
    .returns<
      { id: string; lesson_id: string | null; quiz_id: string | null; step_type: string }[]
    >();

  const stepByLessonId = new Map<string, string>();
  const stepByQuizId = new Map<string, string>();
  for (const step of steps || []) {
    if (step.lesson_id) stepByLessonId.set(step.lesson_id, step.id);
    if (step.quiz_id) stepByQuizId.set(step.quiz_id, step.id);
  }

  const stepUpdates: { id: string; sort_order: number; section_id: string }[] = [];
  const lessonUpdates: { id: string; module_id: string; sort_order: number }[] = [];

  let globalOrder = 0;

  for (const section of sections) {
    let localOrder = 0;
    for (const item of section.items) {
      if (item.kind === "lesson") {
        lessonUpdates.push({
          id: item.id,
          module_id: section.sectionId,
          sort_order: localOrder++,
        });
        const stepId = stepByLessonId.get(item.id);
        if (stepId) {
          stepUpdates.push({
            id: stepId,
            sort_order: globalOrder,
            section_id: section.sectionId,
          });
        }
      } else {
        const stepId = stepByQuizId.get(item.id);
        if (stepId) {
          stepUpdates.push({
            id: stepId,
            sort_order: globalOrder,
            section_id: section.sectionId,
          });
        }
      }
      globalOrder++;
    }
  }

  if (stepUpdates.length > 0) {
    for (let i = 0; i < stepUpdates.length; i++) {
      const { error } = await supabase
        .from("course_steps")
        .update({ sort_order: TEMP_SORT_BASE + i } as never)
        .eq("id", stepUpdates[i].id);
      if (error) throw new Error(error.message);
    }

    for (const update of stepUpdates) {
      const { error } = await supabase
        .from("course_steps")
        .update({
          sort_order: update.sort_order,
          section_id: update.section_id,
        } as never)
        .eq("id", update.id);
      if (error) throw new Error(error.message);
    }
  }

  for (const update of lessonUpdates) {
    const { error } = await supabase
      .from("lessons")
      .update({ module_id: update.module_id, sort_order: update.sort_order } as never)
      .eq("id", update.id);
    if (error) throw new Error(error.message);
  }

  for (const update of lessonUpdates) {
    if (stepByLessonId.has(update.id)) continue;
    const { data: lesson } = await supabase
      .from("lessons")
      .select("id, course_id, module_id, sort_order")
      .eq("id", update.id)
      .maybeSingle<{
        id: string;
        course_id: string;
        module_id: string | null;
        sort_order: number;
      }>();
    if (lesson) await syncLessonToStep(supabase, lesson);
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

/** Keep Phase 2 course_sections in sync with legacy modules (same UUID). */
export async function syncModuleToSection(
  supabase: Db,
  module: { id: string; course_id: string; title: string; sort_order: number }
): Promise<void> {
  const { error } = await supabase.from("course_sections").upsert(
    {
      id: module.id,
      course_id: module.course_id,
      title: module.title,
      sort_order: module.sort_order,
    } as never,
    { onConflict: "id" }
  );
  if (error) throw new Error(error.message);
}

/**
 * Top-level course_steps require a course-wide unique sort_order
 * (uq_course_step_order on course_id + parent_step_id + sort_order).
 * lessons.sort_order is module-local; allocate globally on insert.
 */
export async function getNextTopLevelStepSortOrder(
  supabase: Db,
  courseId: string
): Promise<number> {
  const { data } = await supabase
    .from("course_steps")
    .select("sort_order")
    .eq("course_id", courseId)
    .is("parent_step_id", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();

  return (data?.sort_order ?? -1) + 1;
}

/** Swap course_steps.sort_order for two lessons (used after module-local reorder). */
export async function swapLessonStepSortOrders(
  supabase: Db,
  courseId: string,
  lessonIdA: string,
  lessonIdB: string
): Promise<void> {
  const { data: steps } = await supabase
    .from("course_steps")
    .select("id, lesson_id, sort_order")
    .eq("course_id", courseId)
    .in("lesson_id", [lessonIdA, lessonIdB])
    .is("parent_step_id", null)
    .returns<{ id: string; lesson_id: string; sort_order: number }[]>();

  if (!steps || steps.length !== 2) return;

  const stepA = steps.find((s) => s.lesson_id === lessonIdA);
  const stepB = steps.find((s) => s.lesson_id === lessonIdB);
  if (!stepA || !stepB) return;

  const orderA = stepA.sort_order;
  const orderB = stepB.sort_order;
  if (orderA === orderB) return;

  // Three-step swap: unique index blocks direct A↔B updates.
  const tempOrder = await getNextTopLevelStepSortOrder(supabase, courseId);

  const { error: errTemp } = await supabase
    .from("course_steps")
    .update({ sort_order: tempOrder } as never)
    .eq("id", stepA.id);
  if (errTemp) throw new Error(errTemp.message);

  const { error: errB } = await supabase
    .from("course_steps")
    .update({ sort_order: orderA } as never)
    .eq("id", stepB.id);
  if (errB) throw new Error(errB.message);

  const { error: errA } = await supabase
    .from("course_steps")
    .update({ sort_order: orderB } as never)
    .eq("id", stepA.id);
  if (errA) throw new Error(errA.message);
}

/**
 * Ensure course_sections has a row for the legacy module UUID before writing
 * course_steps.section_id (FK). Seed modules and older data may lack sections
 * because Phase 2 backfill runs before seed.sql.
 */
async function ensureSectionForModule(
  supabase: Db,
  courseId: string,
  moduleId: string | null
): Promise<void> {
  if (!moduleId) return;

  const { data: section } = await supabase
    .from("course_sections")
    .select("id")
    .eq("id", moduleId)
    .maybeSingle<{ id: string }>();

  if (section) return;

  const { data: moduleRow } = await supabase
    .from("modules")
    .select("id, course_id, title, sort_order")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string; course_id: string; title: string; sort_order: number }>();

  if (!moduleRow) {
    throw new Error("Section/module not found for this lesson.");
  }

  await syncModuleToSection(supabase, moduleRow);
}

/** Keep Phase 2 course_steps in sync when a lesson is placed in the tree. */
export async function syncLessonToStep(
  supabase: Db,
  lesson: {
    id: string;
    course_id: string;
    module_id: string | null;
    sort_order: number;
  }
): Promise<void> {
  await ensureSectionForModule(supabase, lesson.course_id, lesson.module_id);

  const { data: existing } = await supabase
    .from("course_steps")
    .select("id, sort_order")
    .eq("course_id", lesson.course_id)
    .eq("lesson_id", lesson.id)
    .is("parent_step_id", null)
    .maybeSingle<{ id: string; sort_order: number }>();

  if (existing) {
    // Preserve global sort_order; only sync placement fields.
    const { error } = await supabase
      .from("course_steps")
      .update({
        course_id: lesson.course_id,
        step_type: "lesson",
        lesson_id: lesson.id,
        topic_id: null,
        quiz_id: null,
        parent_step_id: null,
        section_id: lesson.module_id,
        is_required: true,
      } as never)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const sortOrder = await getNextTopLevelStepSortOrder(supabase, lesson.course_id);
    const { error } = await supabase.from("course_steps").insert({
      course_id: lesson.course_id,
      step_type: "lesson",
      lesson_id: lesson.id,
      topic_id: null,
      quiz_id: null,
      parent_step_id: null,
      section_id: lesson.module_id,
      sort_order: sortOrder,
      is_required: true,
    } as never);
    if (error) throw new Error(error.message);
  }
}

export async function removeLessonStep(
  supabase: Db,
  courseId: string,
  lessonId: string
): Promise<void> {
  const { error } = await supabase
    .from("course_steps")
    .delete()
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId);
  if (error) throw new Error(error.message);
}

export async function removeSection(supabase: Db, sectionId: string): Promise<void> {
  const { error } = await supabase.from("course_sections").delete().eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export async function lessonHasProgress(supabase: Db, lessonId: string): Promise<boolean> {
  const { count } = await supabase
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  return (count ?? 0) > 0;
}

export async function moduleHasProgress(supabase: Db, moduleId: string): Promise<boolean> {
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id")
    .eq("module_id", moduleId)
    .returns<{ id: string }[]>();

  if (!lessons?.length) return false;

  for (const lesson of lessons) {
    if (await lessonHasProgress(supabase, lesson.id)) return true;
  }
  return false;
}

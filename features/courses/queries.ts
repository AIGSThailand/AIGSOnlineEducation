import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import {
  buildPermissions,
  buildSectionsFromModules,
  buildSectionsFromSteps,
  countCurriculumItems,
  toLegacyStructure,
} from "@/features/curriculum/build-structure";
import type {
  CourseBuilderCourse,
  CourseBuilderData,
  CourseListItem,
  CurriculumSection,
  InstructorOption,
} from "@/features/curriculum/types";
import type { Database } from "@/types/database.types";
import type { ModuleWithLessons } from "@/types/lms.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type ModuleRow = Database["public"]["Tables"]["modules"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

type StepRow = {
  id: string;
  course_id: string;
  step_type: "lesson" | "topic" | "quiz";
  lesson_id: string | null;
  quiz_id: string | null;
  section_id: string | null;
  sort_order: number;
};

type LessonMeta = {
  id: string;
  module_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  status: LessonRow["status"];
};

export type CourseSyllabus = {
  sections: CurriculumSection[];
  /** Legacy shape for ModuleWithLessons-based UI (course page + lesson sidebar). */
  modules: ModuleWithLessons[];
  lessonCount: number;
  quizCount: number;
  firstLessonId: string | null;
  structureSource: "course_sections" | "modules_fallback";
};

export interface CourseListFilters {
  search?: string;
  status?: "draft" | "published" | "archived" | "all";
  instructorId?: string;
  limit?: number;
}

export async function getInstructorOptions(): Promise<InstructorOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("role", "instructor")
    .order("first_name", { ascending: true })
    .returns<
      { id: string; email: string; first_name: string | null; last_name: string | null }[]
    >();

  return (data || []).map((p) => ({
    id: p.id,
    email: p.email,
    firstName: p.first_name,
    lastName: p.last_name,
  }));
}

export async function getCourseListForAdmin(
  filters: CourseListFilters = {}
): Promise<CourseListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select(
      `
      id, title, slug, status, updated_at,
      course_instructors (
        instructor:profiles ( first_name, last_name )
      ),
      enrollments ( id )
    `
    )
    .order("updated_at", { ascending: false });

  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  interface RawCourse {
    id: string;
    title: string;
    slug: string;
    status: CourseRow["status"];
    updated_at: string;
    course_instructors: {
      instructor:
        | { first_name: string | null; last_name: string | null }
        | { first_name: string | null; last_name: string | null }[]
        | null;
    }[];
    enrollments: { id: string }[];
  }

  let rows = (data as unknown as RawCourse[]) || [];

  if (filters.instructorId) {
    const instructorCourseIds = await getCourseIdsForInstructor(filters.instructorId);
    rows = rows.filter((r) => instructorCourseIds.includes(r.id));
  }

  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    status: c.status,
    updatedAt: c.updated_at,
    enrollmentCount: c.enrollments?.length ?? 0,
    instructorNames: (c.course_instructors || [])
      .map((ci) => {
        const inst = Array.isArray(ci.instructor) ? ci.instructor[0] : ci.instructor;
        if (!inst) return "";
        return `${inst.first_name || ""} ${inst.last_name || ""}`.trim();
      })
      .filter(Boolean),
  }));
}

export async function getCourseListForInstructor(
  instructorId: string,
  filters: CourseListFilters = {}
): Promise<CourseListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("course_instructors")
    .select(
      `
      course_id,
      course:courses (
        id, title, slug, status, updated_at,
        enrollments ( id ),
        course_instructors (
          instructor:profiles ( first_name, last_name )
        )
      )
    `
    )
    .eq("instructor_id", instructorId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  interface RawItem {
    course_id: string;
    course: {
      id: string;
      title: string;
      slug: string;
      status: CourseRow["status"];
      updated_at: string;
      enrollments: { id: string }[];
      course_instructors: {
        instructor: { first_name: string | null; last_name: string | null } | null;
      }[];
    } | null;
  }

  let items = ((data as unknown as RawItem[]) || [])
    .map((item) => item.course)
    .filter(Boolean) as NonNullable<RawItem["course"]>[];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    items = items.filter((c) => c.title.toLowerCase().includes(q));
  }
  if (filters.status && filters.status !== "all") {
    items = items.filter((c) => c.status === filters.status);
  }

  return items
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      status: c.status,
      updatedAt: c.updated_at,
      enrollmentCount: c.enrollments?.length ?? 0,
      instructorNames: (c.course_instructors || [])
        .map((ci) => {
          const inst = Array.isArray(ci.instructor) ? ci.instructor[0] : ci.instructor;
          if (!inst) return "";
          return `${inst.first_name || ""} ${inst.last_name || ""}`.trim();
        })
        .filter(Boolean),
    }));
}

async function getCourseIdsForInstructor(instructorId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_instructors")
    .select("course_id")
    .eq("instructor_id", instructorId)
    .returns<{ course_id: string }[]>();
  return (data || []).map((r) => r.course_id);
}

async function loadLessonsByIds(ids: string[]): Promise<Map<string, LessonMeta>> {
  const lessonsById = new Map<string, LessonMeta>();
  if (ids.length === 0) return lessonsById;

  const supabase = await createClient();
  const unique = Array.from(new Set(ids));
  const { data } = await supabase
    .from("lessons")
    .select("id, module_id, title, slug, sort_order, status")
    .in("id", unique)
    .returns<LessonMeta[]>();

  for (const lesson of data || []) {
    lessonsById.set(lesson.id, lesson);
  }
  return lessonsById;
}

/**
 * Student/staff course syllabus from course_sections + course_steps (LearnDash),
 * with modules → lessons fallback for older courses.
 */
export async function getCourseSyllabus(courseId: string): Promise<CourseSyllabus> {
  const supabase = await createClient();

  const { data: courseSections } = await supabase
    .from("course_sections")
    .select("id, course_id, title, description, sort_order, wordpress_section_id")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  let sections: CurriculumSection[];
  let structureSource: CourseSyllabus["structureSource"] = "course_sections";

  if (courseSections && courseSections.length > 0) {
    const { data: steps } = await supabase
      .from("course_steps")
      .select("id, course_id, step_type, lesson_id, quiz_id, section_id, sort_order")
      .eq("course_id", courseId)
      .is("parent_step_id", null)
      .order("sort_order", { ascending: true })
      .returns<StepRow[]>();

    const lessonIds = (steps || [])
      .filter((s) => s.step_type === "lesson" && s.lesson_id)
      .map((s) => s.lesson_id as string);

    const quizIds = (steps || []).filter((s) => s.quiz_id).map((s) => s.quiz_id as string);

    const lessonsById = await loadLessonsByIds(lessonIds);

    const quizzesById = new Map<
      string,
      {
        id: string;
        title: string;
        slug: string;
        status: Database["public"]["Enums"]["content_status"];
      }
    >();

    if (quizIds.length > 0) {
      const { data: quizRows } = await supabase
        .from("quizzes")
        .select("id, title, slug, status")
        .in("id", quizIds)
        .returns<
          {
            id: string;
            title: string;
            slug: string;
            status: Database["public"]["Enums"]["content_status"];
          }[]
        >();
      for (const quiz of quizRows || []) {
        quizzesById.set(quiz.id, quiz);
      }
    }

    sections = buildSectionsFromSteps(
      courseSections,
      steps || [],
      lessonsById,
      quizzesById,
      new Set()
    );
  } else {
    structureSource = "modules_fallback";

    const { data: modules } = await supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<ModuleRow[]>();

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id, module_id, title, slug, sort_order, status")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<LessonMeta[]>();

    sections = buildSectionsFromModules(modules || [], lessons || [], new Set());
  }

  const counts = countCurriculumItems(sections);
  const legacy = toLegacyStructure(sections);

  const modules: ModuleWithLessons[] = legacy.map((section) => ({
    id: section.id,
    course_id: courseId,
    title: section.title,
    sort_order: section.sortOrder,
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      module_id: lesson.moduleId,
      course_id: courseId,
      title: lesson.title,
      slug: lesson.slug,
      sort_order: lesson.sortOrder,
    })),
  }));

  return {
    sections,
    modules,
    lessonCount: counts.lessons,
    quizCount: counts.quizzes,
    firstLessonId: modules.flatMap((m) => m.lessons).map((l) => l.id)[0] ?? null,
    structureSource,
  };
}

export async function getCourseBuilderData(
  courseId: string,
  options?: { isAdmin?: boolean }
): Promise<CourseBuilderData | null> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();

  if (!course) return null;

  const user = await getCurrentUser();
  const isAdmin = options?.isAdmin ?? user?.profile?.role === "admin";

  const { data: instructorRows } = await supabase
    .from("course_instructors")
    .select("instructor_id")
    .eq("course_id", courseId)
    .returns<{ instructor_id: string }[]>();

  const { count: enrollmentCount } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId)
    .eq("status", "active");

  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, module_id, title, slug, sort_order, status")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<LessonMeta[]>();

  const lessonsById = new Map((lessons || []).map((l) => [l.id, l]));

  const { data: courseSections } = await supabase
    .from("course_sections")
    .select("id, course_id, title, description, sort_order, wordpress_section_id")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });

  let sections: ReturnType<typeof buildSectionsFromSteps>;
  let structureSource: "course_sections" | "modules_fallback" = "course_sections";

  if (courseSections && courseSections.length > 0) {
    const { data: steps } = await supabase
      .from("course_steps")
      .select("id, course_id, step_type, lesson_id, quiz_id, section_id, sort_order")
      .eq("course_id", courseId)
      .is("parent_step_id", null)
      .order("sort_order", { ascending: true })
      .returns<StepRow[]>();

    const missingLessonIds = (steps || [])
      .filter((s) => s.lesson_id && !lessonsById.has(s.lesson_id))
      .map((s) => s.lesson_id as string);

    if (missingLessonIds.length > 0) {
      const extras = await loadLessonsByIds(missingLessonIds);
      Array.from(extras.entries()).forEach(([id, lesson]) => {
        lessonsById.set(id, lesson);
      });
    }

    const progressLessonIds = new Set<string>();
    const allLessonIds = Array.from(lessonsById.keys());
    if (allLessonIds.length > 0) {
      const { data: progressRows } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .in("lesson_id", allLessonIds)
        .returns<{ lesson_id: string }[]>();
      for (const row of progressRows || []) {
        progressLessonIds.add(row.lesson_id);
      }
    }

    const quizIds = (steps || []).filter((s) => s.quiz_id).map((s) => s.quiz_id as string);

    const quizzesById = new Map<
      string,
      {
        id: string;
        title: string;
        slug: string;
        status: Database["public"]["Enums"]["content_status"];
      }
    >();

    if (quizIds.length > 0) {
      const { data: quizRows } = await supabase
        .from("quizzes")
        .select("id, title, slug, status")
        .in("id", quizIds)
        .returns<
          {
            id: string;
            title: string;
            slug: string;
            status: Database["public"]["Enums"]["content_status"];
          }[]
        >();
      for (const quiz of quizRows || []) {
        quizzesById.set(quiz.id, quiz);
      }
    }

    sections = buildSectionsFromSteps(
      courseSections,
      steps || [],
      lessonsById,
      quizzesById,
      progressLessonIds
    );
  } else {
    structureSource = "modules_fallback";

    const progressLessonIds = new Set<string>();
    const fallbackLessonIds = (lessons || []).map((l) => l.id);
    if (fallbackLessonIds.length > 0) {
      const { data: progressRows } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .in("lesson_id", fallbackLessonIds)
        .returns<{ lesson_id: string }[]>();
      for (const row of progressRows || []) {
        progressLessonIds.add(row.lesson_id);
      }
    }

    const { data: modules } = await supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<ModuleRow[]>();

    sections = buildSectionsFromModules(modules || [], lessons || [], progressLessonIds);
  }

  const instructors = await getInstructorOptions();

  const builderCourse: CourseBuilderCourse = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    excerpt: course.excerpt,
    status: course.status,
    progressionType: course.progression_type,
    accessType: course.access_type ?? "enrollment_required",
    thumbnailUrl: course.thumbnail_url,
    promotionalVideoUrl: course.promotional_video_url ?? null,
    stripeProductId: course.stripe_product_id,
    stripePriceId: course.stripe_price_id,
    wordpressCourseId: course.wordpress_course_id,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
    instructorIds: (instructorRows || []).map((r) => r.instructor_id),
    enrollmentCount: enrollmentCount ?? 0,
  };

  return {
    course: builderCourse,
    sections,
    structure: toLegacyStructure(sections),
    instructors,
    permissions: buildPermissions(isAdmin),
    structureSource,
  };
}

/** Primary builder query alias (spec name). */
export const getCourseBuilder = getCourseBuilderData;

export async function slugExists(slug: string, excludeCourseId?: string): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase.from("courses").select("id").eq("slug", slug);
  if (excludeCourseId) {
    query = query.neq("id", excludeCourseId);
  }
  const { data } = await query.maybeSingle<{ id: string }>();
  return !!data;
}

export async function lessonSlugExists(
  courseId: string,
  slug: string,
  excludeLessonId?: string
): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase.from("lessons").select("id").eq("course_id", courseId).eq("slug", slug);
  if (excludeLessonId) {
    query = query.neq("id", excludeLessonId);
  }
  const { data } = await query.maybeSingle<{ id: string }>();
  return !!data;
}

import { createClient } from "@/lib/supabase/server";
import type {
  CourseBuilderCourse,
  CourseBuilderData,
  CourseListItem,
  CourseStructureModuleItem,
  InstructorOption,
} from "./types";
import type { Database } from "@/types/database.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type ModuleRow = Database["public"]["Tables"]["modules"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

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
    .returns<{ id: string; email: string; first_name: string | null; last_name: string | null }[]>();

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
    course_instructors: { instructor: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null }[];
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
      course_instructors: { instructor: { first_name: string | null; last_name: string | null } | null }[];
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

export async function getCourseBuilderData(courseId: string): Promise<CourseBuilderData | null> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();

  if (!course) return null;

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

  const { data: modules } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<ModuleRow[]>();

  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<LessonRow[]>();

  const lessonIds = (lessons || []).map((l) => l.id);
  const progressLessonIds = new Set<string>();

  if (lessonIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("lesson_progress")
      .select("lesson_id")
      .in("lesson_id", lessonIds)
      .returns<{ lesson_id: string }[]>();
    for (const row of progressRows || []) {
      progressLessonIds.add(row.lesson_id);
    }
  }

  const lessonsByModule = new Map<string, LessonRow[]>();
  for (const lesson of lessons || []) {
    if (!lesson.module_id) continue;
    const list = lessonsByModule.get(lesson.module_id) || [];
    list.push(lesson);
    lessonsByModule.set(lesson.module_id, list);
  }

  const structure: CourseStructureModuleItem[] = (modules || []).map((mod) => ({
    kind: "module" as const,
    id: mod.id,
    title: mod.title,
    description: null,
    sortOrder: mod.sort_order,
    lessons: (lessonsByModule.get(mod.id) || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((lesson) => ({
        kind: "lesson" as const,
        id: lesson.id,
        moduleId: mod.id,
        title: lesson.title,
        slug: lesson.slug,
        sortOrder: lesson.sort_order,
        status: lesson.status ?? "published",
        hasProgress: progressLessonIds.has(lesson.id),
      })),
  }));

  const instructors = await getInstructorOptions();

  const builderCourse: CourseBuilderCourse = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    excerpt: course.excerpt,
    status: course.status,
    progressionType: course.progression_type,
    thumbnailUrl: course.thumbnail_url,
    stripeProductId: course.stripe_product_id,
    stripePriceId: course.stripe_price_id,
    wordpressCourseId: course.wordpress_course_id,
    createdAt: course.created_at,
    updatedAt: course.updated_at,
    instructorIds: (instructorRows || []).map((r) => r.instructor_id),
    enrollmentCount: enrollmentCount ?? 0,
  };

  return { course: builderCourse, structure, instructors };
}

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

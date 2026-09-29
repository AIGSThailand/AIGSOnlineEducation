import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { isPlayerStepComplete } from "@/features/progress/completion";
import { buildPlayerFromModules, buildPlayerFromSteps } from "@/features/player/build-player";
import type { PlayerSection, PlayerStep, StepRow } from "@/features/player/types";

const PAGE = 500;
const IN_CHUNK = 100;

export type CourseOption = { id: string; title: string };

export type EnrollmentProgressRow = {
  enrollmentId: string;
  studentName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  status: string;
  enrolledAt: string;
  completed: number;
  total: number;
  percent: number;
  lastActivityAt: string | null;
  stripeSubscriptionId: string | null;
  wordpressEnrollmentId: number | null;
};

export type EnrollmentProgressStep = {
  key: string;
  title: string;
  kind: "lesson" | "quiz";
  nested: boolean;
  completed: boolean;
  completedAt: string | null;
};

export type EnrollmentProgressDetail = EnrollmentProgressRow & {
  sections: { id: string; title: string; steps: EnrollmentProgressStep[] }[];
};

type Curriculum = {
  sections: PlayerSection[];
  flatSteps: PlayerStep[];
};

type ProgressStamp = { completed: boolean; completedAt: string | null; updatedAt: string };

type EnrollmentRecord = {
  id: string;
  status: string;
  enrolled_at: string;
  student_id: string;
  course_id: string;
  wordpress_enrollment_id: number | null;
  stripe_subscription_id: string | null;
  student:
    | { email: string; first_name: string | null; last_name: string | null }
    | { email: string; first_name: string | null; last_name: string | null }[]
    | null;
  course: { id: string; title: string } | { id: string; title: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function studentName(student: { email: string; first_name: string | null; last_name: string | null } | null): {
  name: string;
  email: string;
} {
  const email = student?.email || "";
  const name = `${student?.first_name || ""} ${student?.last_name || ""}`.trim();
  return { name: name || email || "Student", email };
}

function pairKey(studentId: string, courseId: string): string {
  return `${studentId}:${courseId}`;
}

function later(current: string | null, next: string | null): string | null {
  if (!next) return current;
  if (!current || next > current) return next;
  return current;
}

async function fetchPaged<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await load(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function staffCourseIds(): Promise<string[] | null> {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  if (role === "admin") return null;
  if (role !== "instructor" || !user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_instructors")
    .select("course_id")
    .eq("instructor_id", user.id)
    .returns<{ course_id: string }[]>();
  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.course_id);
}

async function loadCurriculum(courseId: string): Promise<Curriculum | null> {
  const supabase = await createClient();
  const { data: courseSections } = await supabase
    .from("course_sections")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<{ id: string; title: string; sort_order: number }[]>();

  if (courseSections && courseSections.length > 0) {
    const { data: steps } = await supabase
      .from("course_steps")
      .select("id, course_id, step_type, lesson_id, quiz_id, section_id, parent_step_id, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<StepRow[]>();
    const stepRows = steps || [];
    const lessonIds = stepRows.filter((step) => step.lesson_id).map((step) => step.lesson_id as string);
    const quizIds = stepRows.filter((step) => step.quiz_id).map((step) => step.quiz_id as string);
    const lessons = await loadByIds<{ id: string; title: string; module_id: string | null }>(
      "lessons",
      lessonIds,
      "id, title, module_id"
    );
    const quizzes = await loadByIds<{ id: string; title: string }>("quizzes", quizIds, "id, title");
    return buildPlayerFromSteps(
      courseId,
      courseSections,
      stepRows,
      new Map(lessons.map((lesson) => [lesson.id, lesson])),
      new Map(quizzes.map((quiz) => [quiz.id, quiz]))
    );
  }

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<{ id: string; title: string; sort_order: number }[]>();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, title, module_id, sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true })
    .returns<{ id: string; title: string; module_id: string | null; sort_order: number }[]>();
  return buildPlayerFromModules(courseId, modules || [], lessons || []);
}

async function loadByIds<T extends { id: string }>(
  table: "lessons" | "quizzes",
  ids: string[],
  columns: string
): Promise<T[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const unique = Array.from(new Set(ids));
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const { data } = await supabase.from(table).select(columns).in("id", unique.slice(i, i + IN_CHUNK));
    rows.push(...((data as T[] | null) || []));
  }
  return rows;
}

function summarize(
  enrollment: EnrollmentRecord,
  curriculum: Curriculum | undefined,
  stepProgress: Map<string, ProgressStamp>,
  lessonProgress: Map<string, ProgressStamp>
): EnrollmentProgressRow {
  const student = studentName(one(enrollment.student));
  const course = one(enrollment.course);
  const flatSteps = curriculum?.flatSteps || [];
  const stepFlags = new Map<string, boolean>();
  const lessonFlags = new Map<string, boolean>();
  let lastActivityAt: string | null = null;
  for (const [stepId, stamp] of Array.from(stepProgress)) {
    stepFlags.set(stepId, stamp.completed);
    lastActivityAt = later(lastActivityAt, stamp.updatedAt);
  }
  for (const [lessonId, stamp] of Array.from(lessonProgress)) {
    lessonFlags.set(lessonId, stamp.completed);
    lastActivityAt = later(lastActivityAt, stamp.updatedAt);
  }
  const completed = flatSteps.filter((step) => isPlayerStepComplete(step, stepFlags, lessonFlags)).length;
  const total = flatSteps.length;
  return {
    enrollmentId: enrollment.id,
    studentName: student.name,
    email: student.email,
    courseId: enrollment.course_id,
    courseTitle: course?.title || "Course",
    status: enrollment.status,
    enrolledAt: enrollment.enrolled_at,
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    lastActivityAt,
    stripeSubscriptionId: enrollment.stripe_subscription_id,
    wordpressEnrollmentId: enrollment.wordpress_enrollment_id,
  };
}

function detailSections(
  curriculum: Curriculum,
  stepProgress: Map<string, ProgressStamp>,
  lessonProgress: Map<string, ProgressStamp>
): EnrollmentProgressDetail["sections"] {
  const stepFlags = new Map<string, boolean>();
  const lessonFlags = new Map<string, boolean>();
  for (const [stepId, stamp] of Array.from(stepProgress)) stepFlags.set(stepId, stamp.completed);
  for (const [lessonId, stamp] of Array.from(lessonProgress)) lessonFlags.set(lessonId, stamp.completed);

  const completedAtFor = (step: PlayerStep): string | null => {
    if (step.stepId && stepProgress.has(step.stepId)) {
      const stamp = stepProgress.get(step.stepId);
      return stamp?.completed ? stamp.completedAt : null;
    }
    if (step.kind === "lesson") {
      const stamp = lessonProgress.get(step.contentId);
      return stamp?.completed ? stamp.completedAt : null;
    }
    return null;
  };

  return curriculum.sections.map((section) => ({
    id: section.id,
    title: section.title,
    steps: section.items.flatMap((item) => {
      const { children, ...parent } = item;
      return [parent, ...children].map((step) => ({
        key: step.key,
        title: step.title,
        kind: step.kind,
        nested: step.nested,
        completed: isPlayerStepComplete(step, stepFlags, lessonFlags),
        completedAt: completedAtFor(step),
      }));
    }),
  }));
}

async function loadProgress(courseIds: string[]): Promise<{
  steps: Map<string, Map<string, ProgressStamp>>;
  lessons: Map<string, Map<string, ProgressStamp>>;
}> {
  const steps = new Map<string, Map<string, ProgressStamp>>();
  const lessons = new Map<string, Map<string, ProgressStamp>>();
  if (courseIds.length === 0) return { steps, lessons };
  const supabase = await createClient();

  const put = (
    target: Map<string, Map<string, ProgressStamp>>,
    studentId: string,
    courseId: string,
    contentId: string,
    stamp: ProgressStamp
  ) => {
    const key = pairKey(studentId, courseId);
    const bucket = target.get(key) || new Map<string, ProgressStamp>();
    bucket.set(contentId, stamp);
    target.set(key, bucket);
  };

  const stepRows = await fetchPaged<{
    student_id: string;
    course_id: string;
    course_step_id: string;
    completed: boolean;
    completed_at: string | null;
    updated_at: string;
  }>((from, to) =>
    supabase
      .from("step_progress")
      .select("student_id, course_id, course_step_id, completed, completed_at, updated_at")
      .in("course_id", courseIds)
      .order("id", { ascending: true })
      .range(from, to)
  );
  for (const row of stepRows) {
    put(steps, row.student_id, row.course_id, row.course_step_id, {
      completed: row.completed,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    });
  }

  const lessonRows = await fetchPaged<{
    student_id: string;
    course_id: string;
    lesson_id: string;
    completed: boolean;
    completed_at: string | null;
    updated_at: string;
  }>((from, to) =>
    supabase
      .from("lesson_progress")
      .select("student_id, course_id, lesson_id, completed, completed_at, updated_at")
      .in("course_id", courseIds)
      .order("id", { ascending: true })
      .range(from, to)
  );
  for (const row of lessonRows) {
    put(lessons, row.student_id, row.course_id, row.lesson_id, {
      completed: row.completed,
      completedAt: row.completed_at,
      updatedAt: row.updated_at,
    });
  }

  return { steps, lessons };
}

function courseFilter(raw: string | undefined, allowed: string[] | null): string | null {
  const value = raw?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(value)) return null;
  if (allowed && !allowed.includes(value)) return null;
  return value;
}

export async function listEnrollmentProgress(rawCourseId?: string): Promise<{
  courses: CourseOption[];
  rows: EnrollmentProgressRow[];
  selectedCourseId: string | null;
}> {
  const allowed = await staffCourseIds();
  if (allowed && allowed.length === 0) {
    return { courses: [], rows: [], selectedCourseId: null };
  }
  const selectedCourseId = courseFilter(rawCourseId, allowed);
  const supabase = await createClient();

  let courseQuery = supabase.from("courses").select("id, title").order("title", { ascending: true });
  if (allowed) courseQuery = courseQuery.in("id", allowed);
  const { data: courseRows, error: courseError } = await courseQuery.returns<CourseOption[]>();
  if (courseError) throw new Error(courseError.message);

  const enrollments = await fetchPaged<EnrollmentRecord>((from, to) => {
    let query = supabase
      .from("enrollments")
      .select(
        `
        id,
        status,
        enrolled_at,
        student_id,
        course_id,
        wordpress_enrollment_id,
        stripe_subscription_id,
        student:profiles!enrollments_student_id_fkey(email, first_name, last_name),
        course:courses!enrollments_course_id_fkey(id, title)
      `
      )
      .order("enrolled_at", { ascending: false })
      .order("id", { ascending: true });
    if (selectedCourseId) query = query.eq("course_id", selectedCourseId);
    else if (allowed) query = query.in("course_id", allowed);
    return query.range(from, to);
  });

  const courseIds = Array.from(new Set(enrollments.map((row) => row.course_id)));
  const curricula = new Map<string, Curriculum>();
  await Promise.all(
    courseIds.map(async (courseId) => {
      const curriculum = await loadCurriculum(courseId);
      if (curriculum) curricula.set(courseId, curriculum);
    })
  );
  const progress = await loadProgress(courseIds);

  const rows = enrollments.map((enrollment) =>
    summarize(
      enrollment,
      curricula.get(enrollment.course_id),
      progress.steps.get(pairKey(enrollment.student_id, enrollment.course_id)) || new Map(),
      progress.lessons.get(pairKey(enrollment.student_id, enrollment.course_id)) || new Map()
    )
  );

  return { courses: courseRows || [], rows, selectedCourseId };
}

export async function getEnrollmentProgress(enrollmentId: string): Promise<EnrollmentProgressDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId)) return null;
  const allowed = await staffCourseIds();
  if (allowed && allowed.length === 0) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrolled_at,
      student_id,
      course_id,
      wordpress_enrollment_id,
      stripe_subscription_id,
      student:profiles!enrollments_student_id_fkey(email, first_name, last_name),
      course:courses!enrollments_course_id_fkey(id, title)
    `
    )
    .eq("id", enrollmentId)
    .maybeSingle<EnrollmentRecord>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (allowed && !allowed.includes(data.course_id)) return null;

  const curriculum = (await loadCurriculum(data.course_id)) || { sections: [], flatSteps: [] };
  const progress = await loadProgress([data.course_id]);
  const stepProgress = progress.steps.get(pairKey(data.student_id, data.course_id)) || new Map();
  const lessonProgress = progress.lessons.get(pairKey(data.student_id, data.course_id)) || new Map();
  return {
    ...summarize(data, curriculum, stepProgress, lessonProgress),
    sections: detailSections(curriculum, stepProgress, lessonProgress),
  };
}

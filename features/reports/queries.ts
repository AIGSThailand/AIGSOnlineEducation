import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/courses/permissions";

export type EnrollmentTrendDay = {
  day: string;
  count: number;
};

export type CourseCompletionRow = {
  courseId: string;
  title: string;
  enrollmentCount: number;
  completedCount: number;
  completionRate: number;
};

export type MigrationReconcileRow = {
  entity: string;
  liveCount: number;
  mappedCount: number;
  delta: number;
};

function startOfUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Last 30 UTC days of enrollments (including days with zero). */
export async function getEnrollmentTrendLast30Days(): Promise<EnrollmentTrendDay[]> {
  await requireAdmin();
  const supabase = await createClient();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("enrollments")
    .select("enrolled_at")
    .gte("enrolled_at", since.toISOString())
    .returns<{ enrolled_at: string }[]>();

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    counts.set(startOfUtcDay(day), 0);
  }

  for (const row of data || []) {
    const day = row.enrolled_at.slice(0, 10);
    if (counts.has(day)) {
      counts.set(day, (counts.get(day) || 0) + 1);
    }
  }

  return Array.from(counts.entries()).map(([day, count]) => ({ day, count }));
}

/** Published courses: enrollment count vs status=completed. */
export async function getCourseCompletionRates(): Promise<CourseCompletionRow[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: courses, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .eq("status", "published")
    .order("title", { ascending: true })
    .returns<{ id: string; title: string }[]>();

  if (courseError) throw new Error(courseError.message);
  if (!courses?.length) return [];

  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("course_id, status")
    .in(
      "course_id",
      courses.map((c) => c.id)
    )
    .returns<{ course_id: string; status: string }[]>();

  if (enrollError) throw new Error(enrollError.message);

  const byCourse = new Map<string, { total: number; completed: number }>();
  for (const c of courses) {
    byCourse.set(c.id, { total: 0, completed: 0 });
  }
  for (const e of enrollments || []) {
    const bucket = byCourse.get(e.course_id);
    if (!bucket) continue;
    bucket.total += 1;
    if (e.status === "completed") bucket.completed += 1;
  }

  return courses.map((c) => {
    const bucket = byCourse.get(c.id) || { total: 0, completed: 0 };
    const rate = bucket.total === 0 ? 0 : Math.round((bucket.completed / bucket.total) * 1000) / 10;
    return {
      courseId: c.id,
      title: c.title,
      enrollmentCount: bucket.total,
      completedCount: bucket.completed,
      completionRate: rate,
    };
  });
}

/** Live table counts vs wordpress_migration_map distinct sources. */
export async function getMigrationReconciliation(): Promise<MigrationReconcileRow[]> {
  await requireAdmin();
  const supabase = await createClient();

  const [
    profiles,
    courses,
    lessons,
    enrollments,
    mapUsers,
    mapCourses,
    mapLessons,
    mapTopics,
    mapEnrollments,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
    supabase.from("enrollments").select("*", { count: "exact", head: true }),
    supabase
      .from("wordpress_migration_map")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "user"),
    supabase
      .from("wordpress_migration_map")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "sfwd-courses"),
    supabase
      .from("wordpress_migration_map")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "sfwd-lessons"),
    supabase
      .from("wordpress_migration_map")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "sfwd-topic"),
    supabase
      .from("wordpress_migration_map")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "enrollment"),
  ]);

  const liveUsers = profiles.count ?? 0;
  const liveCourses = courses.count ?? 0;
  const liveLessons = lessons.count ?? 0;
  const liveEnrollments = enrollments.count ?? 0;
  const mappedUsers = mapUsers.count ?? 0;
  const mappedCourses = mapCourses.count ?? 0;
  const mappedLessons = (mapLessons.count ?? 0) + (mapTopics.count ?? 0);
  const mappedEnrollments = mapEnrollments.count ?? 0;

  const row = (entity: string, liveCount: number, mappedCount: number): MigrationReconcileRow => ({
    entity,
    liveCount,
    mappedCount,
    delta: liveCount - mappedCount,
  });

  return [
    row("Users (profiles)", liveUsers, mappedUsers),
    row("Courses", liveCourses, mappedCourses),
    row("Lessons (+ topics mapped)", liveLessons, mappedLessons),
    row("Enrollments", liveEnrollments, mappedEnrollments),
  ];
}

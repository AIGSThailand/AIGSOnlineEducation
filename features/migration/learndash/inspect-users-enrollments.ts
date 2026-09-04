import { listLearnDashCourses } from "@/lib/learndash/api/courses";
import {
  fetchLearnDashCourseUsers,
  probeWpUserTotal,
} from "@/lib/learndash/api/users";
import { mapWithConcurrency } from "@/lib/learndash/client";
import { getLearnDashConfig } from "@/lib/learndash/config";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { LearnDashUser } from "@/lib/learndash/types/user";
import {
  formatUsersEnrollmentsReport,
  transformUsersEnrollments,
  type CourseUsersSnapshot,
  type ProposedUsersEnrollments,
} from "./transform-users-enrollments";

export type InspectUsersEnrollmentsOptions = {
  /** Single course id, or omit with allCourses. */
  courseId?: LearnDashEntityId;
  /** Inspect all published courses. */
  allCourses?: boolean;
  /** Optional concurrency for course-users fetches. */
  concurrency?: number;
};

export type UsersEnrollmentsInspection = {
  siteUserTotal: number | null;
  snapshots: CourseUsersSnapshot[];
  proposed: ProposedUsersEnrollments;
  report: string;
};

/**
 * Phase 4: read-only inspect of LearnDash course users → proposed Auth/profile + enrollments.
 * Does NOT write to Supabase Auth or enrollments. Does NOT mutate WordPress.
 */
export async function inspectLearnDashUsersEnrollments(
  options: InspectUsersEnrollmentsOptions
): Promise<UsersEnrollmentsInspection> {
  const config = getLearnDashConfig();
  const concurrency = options.concurrency ?? Math.min(4, config.concurrency || 4);

  let courseList: Array<{ id: number; title: string }> = [];

  if (options.allCourses) {
    const listed = await listLearnDashCourses({ status: "publish" });
    courseList = listed.map((c) => ({ id: c.id, title: c.title }));
  } else if (options.courseId != null && Number.isFinite(options.courseId) && options.courseId > 0) {
    const listed = await listLearnDashCourses({ status: "publish" });
    const match = listed.find((c) => c.id === options.courseId);
    courseList = [
      {
        id: options.courseId,
        title: match?.title || `Course ${options.courseId}`,
      },
    ];
  } else {
    throw new Error("Provide courseId or allCourses: true");
  }

  const siteUserTotal = await probeWpUserTotal();
  const userCache = new Map<number, LearnDashUser>();

  const snapshots = await mapWithConcurrency(courseList, concurrency, async (course) => {
    const fetched = await fetchLearnDashCourseUsers(course.id, {
      siteUserTotal,
      userCache,
    });
    const snap: CourseUsersSnapshot = {
      wordpressCourseId: course.id,
      courseTitle: course.title,
      users: fetched.users,
      source: fetched.source,
      usedV1Fallback: fetched.usedV1Fallback,
      warnings: fetched.warnings,
      v2Count: fetched.v2Count,
      v1Count: fetched.v1Count,
    };
    return snap;
  });

  snapshots.sort((a, b) => a.wordpressCourseId - b.wordpressCourseId);

  const proposed = transformUsersEnrollments(snapshots);
  const report = formatUsersEnrollmentsReport(proposed);

  return {
    siteUserTotal,
    snapshots,
    proposed,
    report,
  };
}

export { formatUsersEnrollmentsReport };

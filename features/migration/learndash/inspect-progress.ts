import { listLearnDashCourses } from "@/lib/learndash/api/courses";
import {
  fetchLearnDashCourseUsers,
  probeWpUserTotal,
} from "@/lib/learndash/api/users";
import { fetchLearnDashUserCourseProgressDetail } from "@/lib/learndash/api/progress";
import { mapWithConcurrency } from "@/lib/learndash/client";
import { getLearnDashConfig } from "@/lib/learndash/config";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { LearnDashUser } from "@/lib/learndash/types/user";
import {
  aggregateProposedProgress,
  formatProgressReport,
  transformUserCourseProgress,
  type ProposedProgressBatch,
} from "./transform-progress";

export type InspectProgressOptions = {
  courseId?: LearnDashEntityId;
  allCourses?: boolean;
  concurrency?: number;
};

export type ProgressInspection = {
  siteUserTotal: number | null;
  proposed: ProposedProgressBatch;
  report: string;
};

/**
 * Phase 5: read-only progress inspect for enrolled users only.
 */
export async function inspectLearnDashProgress(
  options: InspectProgressOptions
): Promise<ProgressInspection> {
  const config = getLearnDashConfig();
  const concurrency = options.concurrency ?? Math.min(3, config.concurrency || 3);

  let courseList: Array<{ id: number; title: string }> = [];
  if (options.allCourses) {
    const listed = await listLearnDashCourses({ status: "publish" });
    courseList = listed.map((c) => ({ id: c.id, title: c.title }));
  } else if (options.courseId != null && options.courseId > 0) {
    const listed = await listLearnDashCourses({ status: "publish" });
    const match = listed.find((c) => c.id === options.courseId);
    courseList = [{ id: options.courseId, title: match?.title || `Course ${options.courseId}` }];
  } else {
    throw new Error("Provide courseId or allCourses: true");
  }

  const siteUserTotal = await probeWpUserTotal();
  const userCache = new Map<number, LearnDashUser>();

  // Collect enrolled (userId, courseId) pairs without full email hydrate (progress needs ids only).
  type Pair = { userId: number; courseId: number; courseTitle: string };
  const pairs: Pair[] = [];

  for (const course of courseList) {
    const fetched = await fetchLearnDashCourseUsers(course.id, {
      siteUserTotal,
      userCache,
      hydrate: false,
    });
    for (const u of fetched.users) {
      pairs.push({ userId: Number(u.id), courseId: course.id, courseTitle: course.title });
    }
  }

  const courses = await mapWithConcurrency(pairs, concurrency, async (pair) => {
    const { header, steps } = await fetchLearnDashUserCourseProgressDetail(
      pair.userId,
      pair.courseId
    );
    return transformUserCourseProgress(pair.userId, pair.courseId, header, steps);
  });

  // Drop empty pairs with no header and no steps (never started).
  const withActivity = courses.filter(
    (c) => c.steps.length > 0 || c.progressStatus !== "unknown" || c.stepsTotal != null
  );

  const proposed = aggregateProposedProgress(withActivity);
  proposed.notes.unshift(
    `Enrolled pairs scanned: ${pairs.length}; with progress activity: ${withActivity.length}.`
  );

  return {
    siteUserTotal,
    proposed,
    report: formatProgressReport(proposed),
  };
}

export { formatProgressReport };

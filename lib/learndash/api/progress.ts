import { fetchAllPages, learndashFetch } from "../client";
import type { LearnDashEntityId } from "../types/common";
import type {
  LearnDashCourseProgressHeader,
  LearnDashCourseProgressStep,
} from "../types/progress";
import { LearnDashError } from "../errors";

const usersPath = (userId: LearnDashEntityId) => `/wp-json/ldlms/v2/users/${userId}`;

/**
 * Course progress headers for a user (one row per course with activity).
 * GET /ldlms/v2/users/{id}/course-progress
 */
export async function listLearnDashUserCourseProgress(
  userId: LearnDashEntityId
): Promise<LearnDashCourseProgressHeader[]> {
  const rows = await fetchAllPages<LearnDashCourseProgressHeader>({
    path: `${usersPath(userId)}/course-progress`,
    query: { orderby: "id", order: "asc" },
  });
  return rows.map((r) => ({ ...r, course: Number(r.course) }));
}

/**
 * Header for one user+course (API may return a one-element array).
 * GET /ldlms/v2/users/{id}/course-progress/{courseId}
 */
export async function getLearnDashUserCourseProgressHeader(
  userId: LearnDashEntityId,
  courseId: LearnDashEntityId
): Promise<LearnDashCourseProgressHeader | null> {
  const { data } = await learndashFetch<LearnDashCourseProgressHeader | LearnDashCourseProgressHeader[]>({
    path: `${usersPath(userId)}/course-progress/${courseId}`,
  });

  if (Array.isArray(data)) {
    const first = data[0];
    return first ? { ...first, course: Number(first.course || courseId) } : null;
  }
  if (data && typeof data === "object") {
    return { ...data, course: Number(data.course || courseId) };
  }
  return null;
}

/**
 * Flatten LD steps payload — this site returns `[[step, step, ...]]` (nested array)
 * with X-WP-Total=1 rather than a paginated flat list.
 */
export function flattenProgressStepsPayload(data: unknown): LearnDashCourseProgressStep[] {
  if (!Array.isArray(data)) return [];

  const out: LearnDashCourseProgressStep[] = [];

  const pushStep = (row: unknown) => {
    if (!row || typeof row !== "object") return;
    const rec = row as LearnDashCourseProgressStep;
    const stepId = Number(rec.step);
    if (!Number.isFinite(stepId) || stepId <= 0) return;
    out.push({
      ...rec,
      step: stepId,
      post_type: String(rec.post_type || ""),
    });
  };

  for (const item of data) {
    if (Array.isArray(item)) {
      for (const inner of item) pushStep(inner);
    } else {
      pushStep(item);
    }
  }

  return out;
}

/**
 * Step-level progress for a user in a course.
 * GET /ldlms/v2/users/{id}/course-progress/{courseId}/steps
 */
export async function listLearnDashUserCourseProgressSteps(
  userId: LearnDashEntityId,
  courseId: LearnDashEntityId
): Promise<LearnDashCourseProgressStep[]> {
  const { data } = await learndashFetch<unknown>({
    path: `${usersPath(userId)}/course-progress/${courseId}/steps`,
    query: { page: 1, per_page: 100 },
  });

  const steps = flattenProgressStepsPayload(data);
  if (steps.length === 0 && data != null) {
    // Unexpected shape — try pagination helper as fallback if flat array of steps.
    if (Array.isArray(data) && data.length > 0 && !Array.isArray(data[0])) {
      return flattenProgressStepsPayload(data);
    }
    throw new LearnDashError(
      "LEARNDASH_INVALID_RESPONSE",
      `Unexpected course-progress steps shape for user ${userId} course ${courseId}`
    );
  }
  return steps;
}

export async function fetchLearnDashUserCourseProgressDetail(
  userId: LearnDashEntityId,
  courseId: LearnDashEntityId
): Promise<{
  header: LearnDashCourseProgressHeader | null;
  steps: LearnDashCourseProgressStep[];
}> {
  let header: LearnDashCourseProgressHeader | null = null;
  try {
    header = await getLearnDashUserCourseProgressHeader(userId, courseId);
  } catch (err) {
    if (!(err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND")) throw err;
  }

  let steps: LearnDashCourseProgressStep[] = [];
  try {
    steps = await listLearnDashUserCourseProgressSteps(userId, courseId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") {
      return { header, steps: [] };
    }
    throw err;
  }

  return { header, steps };
}

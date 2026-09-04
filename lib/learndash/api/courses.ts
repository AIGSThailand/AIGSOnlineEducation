import { fetchAllPages, learndashFetch } from "../client";
import type { LearnDashCourse } from "../types/entities";
import type { LearnDashEntityId } from "../types/common";
import { getRenderedText } from "../types/common";
import type { LearnDashCourseStepsRaw } from "../types/course-step";

const COURSES_PATH = "/wp-json/ldlms/v2/sfwd-courses";

export async function getLearnDashCourse(courseId: LearnDashEntityId): Promise<LearnDashCourse> {
  const { data } = await learndashFetch<LearnDashCourse>({
    path: `${COURSES_PATH}/${courseId}`,
  });
  return data;
}

/**
 * Authoritative curriculum tree for a course.
 * Prefer this over guessing from lesson/topic lists.
 */
export async function getLearnDashCourseSteps(
  courseId: LearnDashEntityId
): Promise<LearnDashCourseStepsRaw> {
  const { data } = await learndashFetch<LearnDashCourseStepsRaw>({
    path: `${COURSES_PATH}/${courseId}/steps`,
  });
  return data;
}

export type LearnDashCourseListItem = {
  id: number;
  title: string;
  slug: string;
  status: string;
  link: string | null;
};

/**
 * List all LearnDash courses (paginated).
 * Avoid context=edit on collections when filters matter; here we only need ids/titles.
 */
export async function listLearnDashCourses(options?: {
  /** Default: publish only. Pass "any" for drafts too (WP REST). */
  status?: string;
}): Promise<LearnDashCourseListItem[]> {
  const status = options?.status ?? "publish";
  const rows = await fetchAllPages<LearnDashCourse>({
    path: COURSES_PATH,
    query: {
      orderby: "id",
      order: "asc",
      status,
    },
  });

  return rows.map((c) => ({
    id: c.id,
    title: getRenderedText(c.title) || `Course ${c.id}`,
    slug: (c.slug || "").trim(),
    status: c.status || "unknown",
    link: c.link || null,
  }));
}

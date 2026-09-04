import type { LearnDashEntityId } from "./common";

/**
 * LearnDash / WP REST user shape as returned by course-users / users endpoints.
 * Email and roles often require authenticated Application Password access.
 */
export type LearnDashUser = {
  id: LearnDashEntityId;
  username?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  slug?: string;
  url?: string;
  description?: string;
  link?: string;
  roles?: string[];
  avatar_urls?: Record<string, string>;
  meta?: Record<string, unknown>;
  /** Plugin-specific fields preserved. */
  [key: string]: unknown;
};

/** Course summary as nested under user→courses (ids or thin objects). */
export type LearnDashUserCourseRef = {
  id: LearnDashEntityId;
  title?: string | { rendered?: string; raw?: string };
  slug?: string;
  status?: string;
  [key: string]: unknown;
};

export type CourseUsersFetchSource = "ldlms-v2" | "ldlms-v1";

export type CourseUsersFetchResult = {
  users: LearnDashUser[];
  source: CourseUsersFetchSource;
  /** True when v2 looked unfiltered and v1 was used (or recommended). */
  usedV1Fallback: boolean;
  warnings: string[];
  /** Raw v2 count before fallback (for diagnostics). */
  v2Count: number;
  v1Count: number | null;
  /** Site-wide WP users total from X-WP-Total when probed. */
  siteUserTotal: number | null;
};

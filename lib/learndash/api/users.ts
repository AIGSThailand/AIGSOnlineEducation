import { fetchAllPages, learndashFetch, mapWithConcurrency } from "../client";
import { getLearnDashConfig } from "../config";
import type { LearnDashEntityId } from "../types/common";
import type {
  CourseUsersFetchResult,
  CourseUsersFetchSource,
  LearnDashUser,
  LearnDashUserCourseRef,
} from "../types/user";
import { LearnDashError } from "../errors";

const COURSES_V2 = "/wp-json/ldlms/v2/sfwd-courses";
const COURSES_V1 = "/wp-json/ldlms/v1/sfwd-courses";
const USERS_V2 = "/wp-json/ldlms/v2/users";
const WP_USERS = "/wp-json/wp/v2/users";

function normalizeUser(raw: LearnDashUser): LearnDashUser {
  const id = Number(raw.id);
  return {
    ...raw,
    id,
    email: typeof raw.email === "string" ? raw.email.trim() : raw.email,
    username: typeof raw.username === "string" ? raw.username.trim() : raw.username,
    name: typeof raw.name === "string" ? raw.name.trim() : raw.name,
    first_name: typeof raw.first_name === "string" ? raw.first_name.trim() : raw.first_name,
    last_name: typeof raw.last_name === "string" ? raw.last_name.trim() : raw.last_name,
    roles: Array.isArray(raw.roles) ? raw.roles.map(String) : raw.roles,
  };
}

/**
 * v1 course-users returns string/number IDs; v2 returns user objects (often unfiltered).
 */
function coerceUserListItems(rows: unknown[]): LearnDashUser[] {
  const out: LearnDashUser[] = [];
  for (const row of rows) {
    if (typeof row === "number" || typeof row === "string") {
      const id = Number(row);
      if (Number.isFinite(id) && id > 0) out.push({ id });
      continue;
    }
    if (row && typeof row === "object") {
      const rec = row as LearnDashUser;
      const id = Number(rec.id);
      if (Number.isFinite(id) && id > 0) out.push(normalizeUser({ ...rec, id }));
    }
  }
  return out;
}

async function listCourseUsersAt(path: string): Promise<LearnDashUser[]> {
  const rows = await fetchAllPages<unknown>({
    path,
    query: {
      // Do not use context=edit on collections — can break filters (see questions gotcha).
      orderby: "id",
      order: "asc",
    },
  });
  return coerceUserListItems(rows);
}

/** First page + X-WP-Total for a course-users collection (cheap unfiltered probe). */
async function probeCourseUsersCollection(path: string): Promise<{
  firstPage: LearnDashUser[];
  total: number | null;
}> {
  const config = getLearnDashConfig();
  const { data, headers } = await learndashFetch<unknown>({
    path,
    query: {
      orderby: "id",
      order: "asc",
      page: 1,
      per_page: config.perPage,
    },
  });
  if (!Array.isArray(data)) {
    throw new LearnDashError(
      "LEARNDASH_INVALID_RESPONSE",
      `Expected array from ${path}, got ${typeof data}`
    );
  }
  const total = Number(headers.get("x-wp-total") || 0);
  return {
    firstPage: coerceUserListItems(data),
    total: total > 0 ? total : null,
  };
}

/**
 * Probe site-wide WP user total (header only). Used to detect unfiltered course-users.
 */
export async function probeWpUserTotal(): Promise<number | null> {
  try {
    const { headers } = await learndashFetch<LearnDashUser[]>({
      path: WP_USERS,
      query: { per_page: 1, page: 1 },
    });
    const total = Number(headers.get("x-wp-total") || 0);
    return total > 0 ? total : null;
  } catch {
    return null;
  }
}

function looksUnfilteredAgainstSite(courseUserTotal: number, siteUserTotal: number | null): boolean {
  if (siteUserTotal != null && siteUserTotal > 0) {
    return courseUserTotal >= Math.max(50, Math.floor(siteUserTotal * 0.9));
  }
  // No site total: still treat very large course-user totals as suspicious.
  return courseUserTotal >= 500;
}

/**
 * Fetch a single WP/LD user. Prefer WP `context=edit` for email + roles.
 */
export async function getLearnDashUser(userId: LearnDashEntityId): Promise<LearnDashUser> {
  // WP users edit context exposes email/roles for authenticated Application Password.
  try {
    const { data } = await learndashFetch<LearnDashUser>({
      path: `${WP_USERS}/${userId}`,
      query: { context: "edit" },
    });
    return normalizeUser(data);
  } catch (err) {
    if (!(err instanceof LearnDashError)) throw err;
  }

  const { data } = await learndashFetch<LearnDashUser>({
    path: `${USERS_V2}/${userId}`,
  });
  return normalizeUser(data);
}

export async function getLearnDashUserSafe(userId: LearnDashEntityId): Promise<LearnDashUser | null> {
  try {
    return await getLearnDashUser(userId);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") return null;
    throw err;
  }
}

/**
 * Expand ID-only stubs (from v1 course-users) into full user records.
 * Optional `cache` avoids re-fetching the same WP user across courses.
 */
export async function hydrateLearnDashUsers(
  stubs: LearnDashUser[],
  options?: {
    concurrency?: number;
    cache?: Map<number, LearnDashUser>;
  }
): Promise<{ users: LearnDashUser[]; missingIds: number[]; warnings: string[] }> {
  const config = getLearnDashConfig();
  const concurrency = options?.concurrency ?? Math.min(6, config.concurrency || 5);
  const cache = options?.cache;
  const warnings: string[] = [];
  const missingIds: number[] = [];

  const users = await mapWithConcurrency(stubs, concurrency, async (stub) => {
    const cached = cache?.get(stub.id);
    if (cached) {
      return normalizeUser({ ...stub, ...cached, id: stub.id });
    }

    // Already rich enough
    if (stub.email && stub.roles && stub.roles.length > 0) {
      const normalized = normalizeUser(stub);
      cache?.set(stub.id, normalized);
      return normalized;
    }

    const full = await getLearnDashUserSafe(stub.id);
    if (!full) {
      missingIds.push(stub.id);
      const normalized = normalizeUser(stub);
      cache?.set(stub.id, normalized);
      return normalized;
    }
    const normalized = normalizeUser({
      ...stub,
      ...full,
      id: stub.id,
    });
    cache?.set(stub.id, normalized);
    return normalized;
  });

  if (missingIds.length > 0) {
    warnings.push(`Could not hydrate ${missingIds.length} user id(s).`);
  }

  return { users, missingIds, warnings };
}

/**
 * Enrolled users for a course via LearnDash REST v2.
 * Path: GET /ldlms/v2/sfwd-courses/{id}/users
 */
export async function listLearnDashCourseUsersV2(
  courseId: LearnDashEntityId
): Promise<LearnDashUser[]> {
  return listCourseUsersAt(`${COURSES_V2}/${courseId}/users`);
}

/**
 * Enrolled users for a course via LearnDash REST v1 (correctly filtered on this site).
 * Returns ID stubs: `["7159", "12871", ...]` — hydrate with getLearnDashUser / hydrateLearnDashUsers.
 * Path: GET /ldlms/v1/sfwd-courses/{id}/users
 */
export async function listLearnDashCourseUsersV1(
  courseId: LearnDashEntityId
): Promise<LearnDashUser[]> {
  return listCourseUsersAt(`${COURSES_V1}/${courseId}/users`);
}

/**
 * Courses a user is enrolled in.
 * Path: GET /ldlms/v2/users/{id}/courses
 */
export async function listLearnDashUserCourses(
  userId: LearnDashEntityId
): Promise<LearnDashUserCourseRef[]> {
  const rows = await fetchAllPages<LearnDashUserCourseRef | number>({
    path: `${USERS_V2}/${userId}/courses`,
    query: {
      orderby: "id",
      order: "asc",
    },
  });

  return rows.map((row) => {
    if (typeof row === "number") {
      return { id: row };
    }
    return { ...row, id: Number(row.id) };
  });
}

/**
 * Fetch course users, preferring v2 when filtered. On this site v2 is unfiltered
 * (~site-wide); we probe X-WP-Total and fall back to v1 ID list + user hydration.
 */
export async function fetchLearnDashCourseUsers(
  courseId: LearnDashEntityId,
  options?: {
    /** Skip site-total probe (faster batch when caller already probed). */
    siteUserTotal?: number | null;
    forceSource?: CourseUsersFetchSource;
    /** Hydrate ID stubs / fill email+roles (default true). */
    hydrate?: boolean;
    /** Shared cache across courses to avoid re-fetching the same WP user. */
    userCache?: Map<number, LearnDashUser>;
  }
): Promise<CourseUsersFetchResult> {
  const warnings: string[] = [];
  const siteUserTotal =
    options?.siteUserTotal !== undefined ? options.siteUserTotal : await probeWpUserTotal();
  const shouldHydrate = options?.hydrate !== false;

  async function maybeHydrate(stubs: LearnDashUser[]): Promise<LearnDashUser[]> {
    if (!shouldHydrate) return stubs;
    const hydrated = await hydrateLearnDashUsers(stubs, { cache: options?.userCache });
    warnings.push(...hydrated.warnings);
    return hydrated.users;
  }

  if (options?.forceSource === "ldlms-v1") {
    const stubs = await listLearnDashCourseUsersV1(courseId);
    const users = await maybeHydrate(stubs);
    return {
      users,
      source: "ldlms-v1",
      usedV1Fallback: true,
      warnings: ["Forced ldlms-v1 course-users source.", ...warnings],
      v2Count: 0,
      v1Count: stubs.length,
      siteUserTotal,
    };
  }

  const v2Path = `${COURSES_V2}/${courseId}/users`;
  let v2ProbeTotal: number | null = null;
  let v2FirstPage: LearnDashUser[] = [];

  try {
    const probe = await probeCourseUsersCollection(v2Path);
    v2FirstPage = probe.firstPage;
    v2ProbeTotal = probe.total ?? (probe.firstPage.length > 0 ? probe.firstPage.length : 0);
  } catch (err) {
    if (err instanceof LearnDashError && err.code === "LEARNDASH_NOT_FOUND") {
      warnings.push(`v2 course-users not found for course ${courseId}; trying v1.`);
    } else {
      throw err;
    }
  }

  if (options?.forceSource === "ldlms-v2") {
    const stubs = await listLearnDashCourseUsersV2(courseId);
    const users = await maybeHydrate(stubs);
    return {
      users,
      source: "ldlms-v2",
      usedV1Fallback: false,
      warnings,
      v2Count: stubs.length,
      v1Count: null,
      siteUserTotal,
    };
  }

  const v2LooksUnfiltered =
    v2ProbeTotal != null && looksUnfilteredAgainstSite(v2ProbeTotal, siteUserTotal);

  if (v2LooksUnfiltered) {
    warnings.push(
      `v2 course-users for ${courseId} reports total=${v2ProbeTotal} ` +
        `(site total ≈ ${siteUserTotal ?? "unknown"}); treating as unfiltered — skipping v2 pagination, using v1 ID list.`
    );
  }

  if (!v2LooksUnfiltered && v2ProbeTotal != null && v2ProbeTotal > 0) {
    const stubs =
      v2FirstPage.length >= v2ProbeTotal
        ? v2FirstPage
        : await listLearnDashCourseUsersV2(courseId);
    const users = await maybeHydrate(stubs);
    return {
      users,
      source: "ldlms-v2",
      usedV1Fallback: false,
      warnings,
      v2Count: stubs.length,
      v1Count: null,
      siteUserTotal,
    };
  }

  let v1Stubs: LearnDashUser[] = [];
  let v1Count: number | null = null;
  try {
    v1Stubs = await listLearnDashCourseUsersV1(courseId);
    v1Count = v1Stubs.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`v1 course-users fallback failed: ${msg}`);
    if (v2FirstPage.length > 0 && !v2LooksUnfiltered) {
      const stubs = await listLearnDashCourseUsersV2(courseId);
      const users = await maybeHydrate(stubs);
      return {
        users,
        source: "ldlms-v2",
        usedV1Fallback: false,
        warnings,
        v2Count: stubs.length,
        v1Count: null,
        siteUserTotal,
      };
    }
    if (v2LooksUnfiltered) {
      throw new LearnDashError(
        "LEARNDASH_INVALID_RESPONSE",
        `v2 course-users appears unfiltered for course ${courseId} and v1 fallback failed: ${msg}`
      );
    }
    throw err;
  }

  const users = await maybeHydrate(v1Stubs);
  return {
    users,
    source: "ldlms-v1",
    usedV1Fallback: true,
    warnings,
    v2Count: v2ProbeTotal ?? 0,
    v1Count,
    siteUserTotal,
  };
}

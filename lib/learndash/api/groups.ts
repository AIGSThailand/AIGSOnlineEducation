import { fetchAllPages, learndashFetch } from "../client";
import { getRenderedText } from "../types/common";
import type { LearnDashEntityId } from "../types/common";
import type { LearnDashGroup } from "../types/group";
import type { LearnDashUser } from "../types/user";
import { coerceUserListFromUnknown } from "./users-coerce";

const GROUPS_V2 = "/wp-json/ldlms/v2/groups";
const GROUPS_V1 = "/wp-json/ldlms/v1/groups";

export type LearnDashGroupListItem = {
  id: number;
  title: string;
  slug: string;
  status: string;
};

export async function listLearnDashGroups(options?: {
  status?: string;
}): Promise<LearnDashGroupListItem[]> {
  const status = options?.status ?? "publish";
  const rows = await fetchAllPages<LearnDashGroup>({
    path: GROUPS_V2,
    query: { orderby: "id", order: "asc", status },
  });
  return rows.map((g) => ({
    id: g.id,
    title: getRenderedText(g.title) || `Group ${g.id}`,
    slug: (g.slug || "").trim() || `group-${g.id}`,
    status: g.status || "publish",
  }));
}

export async function getLearnDashGroup(groupId: LearnDashEntityId): Promise<LearnDashGroup> {
  const { data } = await learndashFetch<LearnDashGroup>({
    path: `${GROUPS_V2}/${groupId}`,
  });
  return data;
}

/**
 * Group members — prefer v1 ID list (reliable); fall back to v2 objects.
 */
export async function listLearnDashGroupUserIds(groupId: LearnDashEntityId): Promise<number[]> {
  try {
    const rows = await fetchAllPages<unknown>({
      path: `${GROUPS_V1}/${groupId}/users`,
      query: { orderby: "id", order: "asc" },
    });
    const users = coerceUserListFromUnknown(rows);
    if (users.length > 0) return users.map((u) => u.id);
  } catch {
    /* fall through to v2 */
  }

  const rows = await fetchAllPages<unknown>({
    path: `${GROUPS_V2}/${groupId}/users`,
    query: { orderby: "id", order: "asc" },
  });
  return coerceUserListFromUnknown(rows).map((u) => u.id);
}

export async function listLearnDashGroupLeaderIds(groupId: LearnDashEntityId): Promise<number[]> {
  try {
    const rows = await fetchAllPages<unknown>({
      path: `${GROUPS_V1}/${groupId}/leaders`,
      query: { orderby: "id", order: "asc" },
    });
    const users = coerceUserListFromUnknown(rows);
    if (users.length > 0 || Array.isArray(rows)) return users.map((u) => u.id);
  } catch {
    /* fall through */
  }

  const rows = await fetchAllPages<unknown>({
    path: `${GROUPS_V2}/${groupId}/leaders`,
    query: { orderby: "id", order: "asc" },
  });
  return coerceUserListFromUnknown(rows).map((u) => u.id);
}

export async function listLearnDashGroupCourseIds(groupId: LearnDashEntityId): Promise<number[]> {
  try {
    const rows = await fetchAllPages<unknown>({
      path: `${GROUPS_V1}/${groupId}/courses`,
      query: { orderby: "id", order: "asc" },
    });
    const ids = coerceIdList(rows);
    if (ids.length > 0) return ids;
  } catch {
    /* fall through */
  }

  const rows = await fetchAllPages<unknown>({
    path: `${GROUPS_V2}/${groupId}/courses`,
    query: { orderby: "id", order: "asc" },
  });
  return coerceIdList(rows);
}

function coerceIdList(rows: unknown[]): number[] {
  const out: number[] = [];
  for (const row of rows) {
    if (typeof row === "number" || typeof row === "string") {
      const id = Number(row);
      if (Number.isFinite(id) && id > 0) out.push(id);
      continue;
    }
    if (row && typeof row === "object" && "id" in row) {
      const id = Number((row as { id: unknown }).id);
      if (Number.isFinite(id) && id > 0) out.push(id);
    }
  }
  return out;
}

/** Re-export type for callers that hydrate. */
export type { LearnDashUser };

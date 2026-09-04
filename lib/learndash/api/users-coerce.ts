import type { LearnDashUser } from "../types/user";

/**
 * Shared coercion for LD list endpoints that return id strings/numbers or user objects.
 * Extracted so course-users and group-users share the same logic.
 */
export function coerceUserListFromUnknown(rows: unknown[]): LearnDashUser[] {
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
      if (Number.isFinite(id) && id > 0) {
        out.push({
          ...rec,
          id,
          email: typeof rec.email === "string" ? rec.email.trim() : rec.email,
          username: typeof rec.username === "string" ? rec.username.trim() : rec.username,
          name: typeof rec.name === "string" ? rec.name.trim() : rec.name,
          roles: Array.isArray(rec.roles) ? rec.roles.map(String) : rec.roles,
        });
      }
    }
  }
  return out;
}

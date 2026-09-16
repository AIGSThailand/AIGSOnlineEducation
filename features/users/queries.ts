import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database.types";
import type {
  AdminAuditEvent,
  AdminUserListFilters,
  AdminUserListItem,
  AdminUserListResult,
  CourseOption,
  UserAuthActivityEvent,
} from "./types";

type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  wordpress_user_id: number | null;
  created_at: string;
};

const DEFAULT_PAGE_SIZE = 25;

export async function listUsersForAdmin(
  filters: AdminUserListFilters = {}
): Promise<AdminUserListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = filters.q?.trim() || "";
  const role = filters.role && filters.role !== "all" ? filters.role : null;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role, wordpress_user_id, created_at", {
      count: "exact",
    });

  if (role) {
    query = query.eq("role", role);
  }

  if (q) {
    const safe = q.replace(/[,()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `email.ilike.%${safe}%,first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`
      );
    }
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<ProfileRow[]>();

  if (error) throw new Error(error.message);

  const profiles = data || [];
  const [authById, coursesByInstructor] = await Promise.all([
    loadAuthMetaForUserIds(profiles.map((p) => p.id)),
    loadInstructorCourses(
      profiles.filter((p) => p.role === "instructor" || p.role === "admin").map((p) => p.id)
    ),
  ]);

  const users: AdminUserListItem[] = profiles.map((p) => {
    const auth = authById.get(p.id);
    return {
      id: p.id,
      email: p.email,
      firstName: p.first_name,
      lastName: p.last_name,
      role: p.role,
      wordpressUserId: p.wordpress_user_id,
      createdAt: p.created_at,
      lastSignInAt: auth?.lastSignInAt ?? null,
      emailConfirmedAt: auth?.emailConfirmedAt ?? null,
      bannedUntil: auth?.bannedUntil ?? null,
      instructorCourses: coursesByInstructor.get(p.id) || [],
    };
  });

  const total = count ?? users.length;
  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function loadAuthMetaForUserIds(userIds: string[]) {
  const map = new Map<
    string,
    { lastSignInAt: string | null; emailConfirmedAt: string | null; bannedUntil: string | null }
  >();

  if (userIds.length === 0) return map;

  const admin = createAdminClient();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data.user) {
          map.set(id, { lastSignInAt: null, emailConfirmedAt: null, bannedUntil: null });
          return;
        }
        const user = data.user;
        map.set(id, {
          lastSignInAt: user.last_sign_in_at ?? null,
          emailConfirmedAt: user.email_confirmed_at ?? null,
          bannedUntil: (user as { banned_until?: string | null }).banned_until ?? null,
        });
      } catch {
        map.set(id, { lastSignInAt: null, emailConfirmedAt: null, bannedUntil: null });
      }
    })
  );

  return map;
}

async function loadInstructorCourses(instructorIds: string[]) {
  const map = new Map<string, { id: string; title: string }[]>();
  if (instructorIds.length === 0) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("course_instructors")
    .select("instructor_id, course:courses(id, title)")
    .in("instructor_id", instructorIds);

  if (error) throw new Error(error.message);

  for (const row of (data as
    | {
        instructor_id: string;
        course: { id: string; title: string } | { id: string; title: string }[] | null;
      }[]
    | null) || []) {
    const course = Array.isArray(row.course) ? row.course[0] : row.course;
    if (!course) continue;
    const list = map.get(row.instructor_id) || [];
    list.push({ id: course.id, title: course.title });
    map.set(row.instructor_id, list);
  }

  return map;
}

export async function listCoursesForInstructorAssignment(): Promise<CourseOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, status")
    .order("title", { ascending: true })
    .returns<CourseOption[]>();

  if (error) throw new Error(error.message);
  return (data || []).map((c) => ({
    id: c.id,
    title: c.title,
    status: c.status,
  }));
}

export async function countAdmins(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listRecentAdminAuditEvents(limit = 20): Promise<AdminAuditEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_events")
    .select(
      `
      id,
      action,
      actor_id,
      target_user_id,
      metadata,
      created_at,
      actor:profiles!admin_audit_events_actor_id_fkey(email),
      target:profiles!admin_audit_events_target_user_id_fkey(email)
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Table may not exist until migration is applied.
    console.error("[listRecentAdminAuditEvents]", error.message);
    return [];
  }

  type Row = {
    id: string;
    action: string;
    actor_id: string | null;
    target_user_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    actor: { email: string } | { email: string }[] | null;
    target: { email: string } | { email: string }[] | null;
  };

  return ((data as unknown as Row[] | null) || []).map((row) => {
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const target = Array.isArray(row.target) ? row.target[0] : row.target;
    return {
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorEmail: actor?.email ?? null,
      targetUserId: row.target_user_id,
      targetEmail: target?.email ?? null,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    };
  });
}

export async function listUserAuthActivity(
  userId: string,
  limit = 25
): Promise<UserAuthActivityEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "admin_list_user_auth_events" as never,
    { p_user_id: userId, p_limit: limit } as never
  );

  if (error) {
    console.error("[listUserAuthActivity]", error.message);
    return [];
  }

  return (
    (data as { id: string; created_at: string; action: string; ip_address: string | null }[] | null) ||
    []
  ).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    ipAddress: row.ip_address,
  }));
}

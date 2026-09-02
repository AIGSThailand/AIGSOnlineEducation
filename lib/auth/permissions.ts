import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserProfile, AuthSessionUser } from "@/types/auth.types";
import type { UserRole } from "@/types/database.types";

/**
 * Retrieves the currently authenticated user and their database profile.
 * Server-only helper.
 */
export async function getCurrentUser(): Promise<AuthSessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<UserProfile>();

  return {
    id: user.id,
    email: user.email || "",
    profile: profile || null,
  };
}

/**
 * Enforces that a user is authenticated, redirecting to /login if not.
 */
export async function requireAuth(): Promise<AuthSessionUser> {
  const authUser = await getCurrentUser();

  if (!authUser) {
    redirect("/login");
  }

  return authUser;
}

/**
 * Enforces role-based authorization for Server Components and Server Actions.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthSessionUser> {
  const authUser = await requireAuth();
  const role = authUser.profile?.role;

  if (!role || !allowedRoles.includes(role)) {
    redirect("/login?error=unauthorized");
  }

  return authUser;
}

/**
 * Verifies course access: enrollment, instructor assignment, admin, or group membership.
 */
export async function canAccessCourse(courseId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const role = user.profile?.role;
  if (role === "admin") return true;

  const supabase = await createClient();

  if (role === "instructor") {
    const { data } = await supabase
      .from("course_instructors")
      .select("course_id")
      .eq("course_id", courseId)
      .eq("instructor_id", user.id)
      .maybeSingle<{ course_id: string }>();

    if (data) return true;
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("status")
    .eq("course_id", courseId)
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle<{ status: string }>();

  if (enrollment) return true;

  // Group-based access (LearnDash groups → group_courses + group_users)
  const { data: groupCourses } = await supabase
    .from("group_courses")
    .select("group_id")
    .eq("course_id", courseId)
    .returns<{ group_id: string }[]>();

  if (groupCourses && groupCourses.length > 0) {
    const groupIds = groupCourses.map((g) => g.group_id);
    const { data: membership } = await supabase
      .from("group_users")
      .select("group_id")
      .eq("user_id", user.id)
      .in("group_id", groupIds)
      .limit(1)
      .returns<{ group_id: string }[]>();

    if (membership && membership.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if the current user is a leader of the given group.
 */
export async function isGroupLeader(groupId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.profile?.role === "admin") return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("group_leaders")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle<{ group_id: string }>();

  return !!data;
}

/**
 * Returns true if the current user can manage the given group (admin or group leader).
 */
export async function canManageGroup(groupId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.profile?.role === "admin") return true;

  return isGroupLeader(groupId);
}

/**
 * Returns true if the current user has course access via group membership.
 */
export async function hasGroupCourseAccess(courseId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data: groupCourses } = await supabase
    .from("group_courses")
    .select("group_id")
    .eq("course_id", courseId)
    .returns<{ group_id: string }[]>();

  if (!groupCourses?.length) return false;

  const groupIds = groupCourses.map((g) => g.group_id);
  const { data: membership } = await supabase
    .from("group_users")
    .select("group_id")
    .eq("user_id", user.id)
    .in("group_id", groupIds)
    .limit(1)
    .returns<{ group_id: string }[]>();

  return !!membership?.length;
}

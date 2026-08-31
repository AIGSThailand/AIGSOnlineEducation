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
    .single();

  return {
    id: user.id,
    email: user.email || "",
    profile: (profile as UserProfile) || null,
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
 * Never relies only on client checks.
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
 * Verifies if a user has active enrollment or instructor/admin privileges for a course.
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
      .maybeSingle();

    return !!data;
  }

  // Check student active enrollment
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("status")
    .eq("course_id", courseId)
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  return !!enrollment;
}

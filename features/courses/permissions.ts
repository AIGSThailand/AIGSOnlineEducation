import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, requireAuth } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import type { AuthSessionUser } from "@/types/auth.types";
import type { BuilderPortal } from "./types";

export async function canManageCourse(courseId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.profile?.role === "admin") return true;

  if (user.profile?.role === "instructor") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("course_instructors")
      .select("course_id")
      .eq("course_id", courseId)
      .eq("instructor_id", user.id)
      .maybeSingle<{ course_id: string }>();
    return !!data;
  }

  return false;
}

export async function canCreateCourse(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user?.profile?.role) return false;
  return user.profile.role === "admin" || user.profile.role === "instructor";
}

export async function requireCourseBuilderAccess(portal: BuilderPortal): Promise<AuthSessionUser> {
  const authUser = await requireAuth();
  const role = authUser.profile?.role;

  if (portal === "admin" && role !== "admin") {
    redirect("/login?error=unauthorized");
  }

  if (portal === "instructor" && role !== "instructor" && role !== "admin") {
    redirect("/login?error=unauthorized");
  }

  return authUser;
}

export async function requireCourseManage(courseId: string): Promise<AuthSessionUser> {
  const authUser = await requireAuth();
  const allowed = await canManageCourse(courseId);

  if (!allowed) {
    redirect("/login?error=unauthorized");
  }

  return authUser;
}

export async function requireAdmin(): Promise<AuthSessionUser> {
  const authUser = await requireAuth();
  if (authUser.profile?.role !== "admin") {
    redirect("/login?error=unauthorized");
  }
  return authUser;
}

export function isAdmin(user: AuthSessionUser): boolean {
  return user.profile?.role === "admin";
}

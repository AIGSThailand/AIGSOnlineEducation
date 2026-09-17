"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientEnv } from "@/lib/env/client";
import { requireAdmin } from "@/features/courses/permissions";
import type { ActionResult } from "@/features/courses/types";
import {
  inviteUserSchema,
  setInstructorCoursesSchema,
  setUserBanSchema,
  updateUserRoleSchema,
  userIdSchema,
} from "./schema";
import { countAdmins, listUserAuthActivity } from "./queries";
import { writeAdminAuditEvent } from "./audit";
import type { UserAuthActivityEvent } from "./types";

/** Long-lived ban (~100 years) — Supabase Admin API ban_duration format. */
const BAN_DURATION_LONG = "876000h";

function revalidateUsers() {
  revalidatePath("/admin/users");
}

export async function updateUserRoleAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid role update." };
  }

  const { userId, role } = parsed.data;
  const supabase = await createClient();

  const { data: target, error: loadError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();

  if (loadError) return { success: false, error: loadError.message };
  if (!target) return { success: false, error: "User not found." };

  if (target.role === role) {
    return { success: true };
  }

  if (target.role === "admin" && role !== "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return {
        success: false,
        error: "Cannot change role: this is the last admin account.",
      };
    }
  }

  if (admin.id === userId && role !== "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return {
        success: false,
        error: "You cannot demote yourself while you are the only admin.",
      };
    }
  }

  const previousRole = target.role;
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() } as never)
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  await writeAdminAuditEvent({
    actorId: admin.id,
    action: "role_change",
    targetUserId: userId,
    metadata: { from: previousRole, to: role },
  });

  revalidateUsers();
  return { success: true };
}

export async function inviteUserAction(
  input: unknown
): Promise<ActionResult<{ userId: string }>> {
  const admin = await requireAdmin();
  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid invite." };
  }

  const { email, role } = parsed.data;
  const { NEXT_PUBLIC_APP_URL: origin } = getClientEnv();
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/api/auth/callback`,
    data: { role },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return {
        success: false,
        error:
          "A user with this email already exists. Search for them and change their role instead.",
      };
    }
    return { success: false, error: error.message };
  }

  const userId = data.user?.id;
  if (userId) {
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({
        role,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", userId);

    await writeAdminAuditEvent({
      actorId: admin.id,
      action: "invite",
      targetUserId: userId,
      metadata: { email, role },
    });
  }

  revalidateUsers();
  return { success: true, data: { userId: userId || "" } };
}

export async function sendPasswordResetAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid user." };
  }

  const supabase = await createClient();
  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", parsed.data.userId)
    .maybeSingle<{ email: string }>();

  if (loadError) return { success: false, error: loadError.message };
  if (!profile?.email) return { success: false, error: "User email not found." };

  const { NEXT_PUBLIC_APP_URL: origin } = getClientEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) return { success: false, error: error.message };

  await writeAdminAuditEvent({
    actorId: admin.id,
    action: "password_reset_sent",
    targetUserId: parsed.data.userId,
    metadata: { email: profile.email },
  });

  return { success: true };
}

export async function resendConfirmationAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = userIdSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid user." };
  }

  const adminClient = createAdminClient();
  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(
    parsed.data.userId
  );

  if (authError || !authData.user?.email) {
    return { success: false, error: authError?.message || "User not found in Auth." };
  }

  if (authData.user.email_confirmed_at) {
    return { success: false, error: "This email is already confirmed." };
  }

  const { NEXT_PUBLIC_APP_URL: origin } = getClientEnv();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: authData.user.email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error) return { success: false, error: error.message };

  await writeAdminAuditEvent({
    actorId: admin.id,
    action: "confirmation_resent",
    targetUserId: parsed.data.userId,
    metadata: { email: authData.user.email },
  });

  return { success: true };
}

export async function setUserBanAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = setUserBanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid ban request." };
  }

  const { userId, banned } = parsed.data;

  if (admin.id === userId) {
    return { success: false, error: "You cannot ban your own account." };
  }

  const supabase = await createClient();
  const { data: target, error: loadError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();

  if (loadError) return { success: false, error: loadError.message };
  if (!target) return { success: false, error: "User not found." };

  if (banned && target.role === "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      return { success: false, error: "Cannot ban the last admin account." };
    }
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: banned ? BAN_DURATION_LONG : "none",
  });

  if (error) return { success: false, error: error.message };

  await writeAdminAuditEvent({
    actorId: admin.id,
    action: banned ? "ban" : "unban",
    targetUserId: userId,
    metadata: banned ? { ban_duration: BAN_DURATION_LONG } : {},
  });

  revalidateUsers();
  return { success: true };
}

export async function setInstructorCoursesAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = setInstructorCoursesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid courses." };
  }

  const { userId, courseIds } = parsed.data;
  const uniqueIds = Array.from(new Set(courseIds));
  const supabase = await createClient();

  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle<{ id: string; role: string }>();

  if (loadError) return { success: false, error: loadError.message };
  if (!profile) return { success: false, error: "User not found." };
  if (profile.role !== "instructor" && profile.role !== "admin") {
    return {
      success: false,
      error: "Only instructors (or admins) can be assigned to courses this way.",
    };
  }

  const { error: delError } = await supabase
    .from("course_instructors")
    .delete()
    .eq("instructor_id", userId);
  if (delError) return { success: false, error: delError.message };

  if (uniqueIds.length > 0) {
    const { error: insError } = await supabase.from("course_instructors").insert(
      uniqueIds.map((courseId) => ({
        course_id: courseId,
        instructor_id: userId,
      })) as never
    );
    if (insError) return { success: false, error: insError.message };
  }

  await writeAdminAuditEvent({
    actorId: admin.id,
    action: "instructor_courses_set",
    targetUserId: userId,
    metadata: { courseCount: uniqueIds.length },
  });

  revalidateUsers();
  return { success: true };
}

export async function getUserAuthActivityAction(
  userId: string
): Promise<ActionResult<UserAuthActivityEvent[]>> {
  await requireAdmin();
  const parsed = userIdSchema.safeParse({ userId });
  if (!parsed.success) {
    return { success: false, error: "Invalid user." };
  }

  try {
    const events = await listUserAuthActivity(parsed.data.userId, 25);
    return { success: true, data: events };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load auth activity.",
    };
  }
}

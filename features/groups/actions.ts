"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { slugifyTitle } from "@/features/courses/builder/ordering";
import {
  addGroupMemberSchema,
  createGroupSchema,
  removeGroupMemberSchema,
  setGroupCoursesSchema,
  updateGroupSchema,
} from "./schema";
import { getGroupCourseIdsAdmin } from "./queries";
import { ensureGroupMembership, materializeGroupCourseEnrollments } from "./materialize";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateGroupPaths(groupId?: string) {
  revalidatePath("/admin/groups");
  if (groupId) {
    revalidatePath(`/admin/groups/${groupId}`);
    revalidatePath(`/bundles/${groupId}`);
  }
}

export async function createGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireCourseBuilderAccess("admin");
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid group." };
  }

  const name = parsed.data.name;
  const slug = (parsed.data.slug || slugifyTitle(name) || "group").slice(0, 200);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      slug,
      description: parsed.data.description || null,
      status: parsed.data.status || "active",
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.message.includes("uq_groups_slug") || error.code === "23505") {
      return { success: false, error: "That slug is already in use." };
    }
    return { success: false, error: error.message };
  }

  revalidateGroupPaths(data.id);
  return { success: true, data: { id: data.id } };
}

export async function updateGroupAction(input: unknown): Promise<ActionResult> {
  await requireCourseBuilderAccess("admin");
  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid update." };
  }

  const { groupId, ...fields } = parsed.data;
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (fields.name !== undefined) updatePayload.name = fields.name;
  if (fields.slug !== undefined) updatePayload.slug = fields.slug;
  if (fields.description !== undefined) updatePayload.description = fields.description;
  if (fields.status !== undefined) updatePayload.status = fields.status;
  if (fields.stripeProductId !== undefined) {
    updatePayload.stripe_product_id = fields.stripeProductId || null;
  }
  if (fields.stripePriceId !== undefined) {
    updatePayload.stripe_price_id = fields.stripePriceId || null;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("groups").update(updatePayload as never).eq("id", groupId);

  if (error) {
    if (error.message.includes("uq_groups_slug") || error.code === "23505") {
      return { success: false, error: "That slug is already in use." };
    }
    return { success: false, error: error.message };
  }

  revalidateGroupPaths(groupId);
  return { success: true };
}

export async function setGroupCoursesAction(input: unknown): Promise<ActionResult> {
  await requireCourseBuilderAccess("admin");
  const parsed = setGroupCoursesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid courses." };
  }

  const { groupId, courseIds } = parsed.data;
  const uniqueIds = Array.from(new Set(courseIds));
  const supabase = await createClient();

  const { error: delError } = await supabase.from("group_courses").delete().eq("group_id", groupId);
  if (delError) return { success: false, error: delError.message };

  if (uniqueIds.length > 0) {
    const { error: insError } = await supabase.from("group_courses").insert(
      uniqueIds.map((courseId) => ({
        group_id: groupId,
        course_id: courseId,
      })) as never
    );
    if (insError) return { success: false, error: insError.message };
  }

  // Materialize for existing members
  const { data: members } = await supabase
    .from("group_users")
    .select("user_id")
    .eq("group_id", groupId)
    .returns<{ user_id: string }[]>();

  for (const m of members || []) {
    await materializeGroupCourseEnrollments({
      userId: m.user_id,
      groupId,
      courseIds: uniqueIds,
      enrollmentSource: "group",
      sourceReference: groupId,
    });
  }

  revalidateGroupPaths(groupId);
  return { success: true };
}

export async function addGroupMemberAction(input: unknown): Promise<ActionResult> {
  await requireCourseBuilderAccess("admin");
  const parsed = addGroupMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid member." };
  }

  const { groupId, userId } = parsed.data;
  try {
    await ensureGroupMembership(userId, groupId);
    const courseIds = await getGroupCourseIdsAdmin(groupId);
    await materializeGroupCourseEnrollments({
      userId,
      groupId,
      courseIds,
      enrollmentSource: "group",
      sourceReference: groupId,
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add member." };
  }

  revalidateGroupPaths(groupId);
  return { success: true };
}

export async function removeGroupMemberAction(input: unknown): Promise<ActionResult> {
  await requireCourseBuilderAccess("admin");
  const parsed = removeGroupMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid member." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("group_users")
    .delete()
    .eq("group_id", parsed.data.groupId)
    .eq("user_id", parsed.data.userId);

  if (error) return { success: false, error: error.message };

  // Do not revoke course enrollments automatically — paid/group history may still apply.
  revalidateGroupPaths(parsed.data.groupId);
  return { success: true };
}

export async function searchGroupMembersAction(
  query: string
): Promise<
  ActionResult<
    { id: string; email: string; first_name: string | null; last_name: string | null; role: string }[]
  >
> {
  await requireCourseBuilderAccess("admin");
  const q = query.trim();
  if (q.length < 2) return { success: true, data: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name, role")
    .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(12)
    .returns<
      { id: string; email: string; first_name: string | null; last_name: string | null; role: string }[]
    >();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data || [] };
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GroupDetail, GroupListItem, GroupMemberRow } from "./types";

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  wordpress_group_id: number | null;
  updated_at: string;
};

export async function listGroupsForAdmin(): Promise<GroupListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, slug, description, status, stripe_product_id, stripe_price_id, wordpress_group_id, updated_at"
    )
    .order("updated_at", { ascending: false })
    .returns<GroupRow[]>();

  if (error) throw new Error(error.message);

  const groups = data || [];
  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.id);
  const [{ data: courseLinks }, { data: memberLinks }] = await Promise.all([
    supabase.from("group_courses").select("group_id").in("group_id", ids),
    supabase.from("group_users").select("group_id").in("group_id", ids),
  ]);

  const courseCount = new Map<string, number>();
  for (const row of (courseLinks as { group_id: string }[] | null) || []) {
    courseCount.set(row.group_id, (courseCount.get(row.group_id) || 0) + 1);
  }
  const memberCount = new Map<string, number>();
  for (const row of (memberLinks as { group_id: string }[] | null) || []) {
    memberCount.set(row.group_id, (memberCount.get(row.group_id) || 0) + 1);
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    description: g.description,
    status: g.status,
    stripeProductId: g.stripe_product_id,
    stripePriceId: g.stripe_price_id,
    wordpressGroupId: g.wordpress_group_id,
    updatedAt: g.updated_at,
    courseCount: courseCount.get(g.id) || 0,
    memberCount: memberCount.get(g.id) || 0,
  }));
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select(
      "id, name, slug, description, status, stripe_product_id, stripe_price_id, wordpress_group_id, updated_at"
    )
    .eq("id", groupId)
    .maybeSingle<GroupRow>();

  if (error) throw new Error(error.message);
  if (!group) return null;

  const [{ data: courseLinks }, { data: memberLinks }] = await Promise.all([
    supabase
      .from("group_courses")
      .select("course_id, course:courses(id, title, status)")
      .eq("group_id", groupId),
    supabase
      .from("group_users")
      .select("user_id, joined_at, profile:profiles(email, first_name, last_name)")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: false }),
  ]);

  const courses = (
    (courseLinks as
      | {
          course_id: string;
          course: { id: string; title: string; status: string } | { id: string; title: string; status: string }[] | null;
        }[]
      | null) || []
  ).map((row) => {
    const course = Array.isArray(row.course) ? row.course[0] : row.course;
    return {
      id: course?.id || row.course_id,
      title: course?.title || "Unknown course",
      status: course?.status || "draft",
    };
  });

  const members: GroupMemberRow[] = (
    (memberLinks as
      | {
          user_id: string;
          joined_at: string;
          profile:
            | { email: string; first_name: string | null; last_name: string | null }
            | { email: string; first_name: string | null; last_name: string | null }[]
            | null;
        }[]
      | null) || []
  ).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      userId: row.user_id,
      email: profile?.email || "",
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      joinedAt: row.joined_at,
    };
  });

  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    description: group.description,
    status: group.status,
    stripeProductId: group.stripe_product_id,
    stripePriceId: group.stripe_price_id,
    wordpressGroupId: group.wordpress_group_id,
    courses,
    members,
  };
}

export async function listPublishedCoursesForGroupPicker(): Promise<
  { id: string; title: string; status: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, status")
    .order("title", { ascending: true })
    .returns<{ id: string; title: string; status: string }[]>();

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPublicGroupBundle(groupId: string): Promise<GroupDetail | null> {
  const supabase = await createClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select(
      "id, name, slug, description, status, stripe_product_id, stripe_price_id, wordpress_group_id, updated_at"
    )
    .eq("id", groupId)
    .eq("status", "active")
    .maybeSingle<GroupRow>();

  if (error) throw new Error(error.message);
  if (!group) return null;

  const detail = await getGroupDetail(groupId);
  return detail;
}

/** Service-role: course IDs attached to a group (for Stripe fulfillment). */
export async function getGroupCourseIdsAdmin(groupId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("group_courses")
    .select("course_id")
    .eq("group_id", groupId)
    .returns<{ course_id: string }[]>();

  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.course_id);
}

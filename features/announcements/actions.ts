"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/courses/permissions";
import type { ActionResult } from "@/features/courses/types";
import {
  announcementIdSchema,
  announcementStatusSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "./schema";

function emptyToNull(value?: string | null) {
  if (!value || value === "") return null;
  return value;
}

function revalidateAnnouncements(id?: string) {
  revalidatePath("/admin/announcements");
  revalidatePath("/student/announcements");
  revalidatePath("/student/dashboard");
  revalidatePath("/instructor/dashboard");
  if (id) {
    revalidatePath(`/admin/announcements/${id}`);
    revalidatePath(`/student/announcements/${id}`);
  }
}

export async function createAnnouncementAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = createAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid announcement." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: parsed.data.title,
      body_html: parsed.data.bodyHtml || "",
      status: parsed.data.status || "draft",
      audience: parsed.data.audience || "all",
      starts_at: emptyToNull(parsed.data.startsAt),
      ends_at: emptyToNull(parsed.data.endsAt),
      created_by: admin.id,
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error) return { success: false, error: error.message };

  revalidateAnnouncements(data.id);
  return { success: true, data: { id: data.id } };
}

export async function updateAnnouncementAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid update." };
  }

  const { announcementId, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      title: fields.title,
      body_html: fields.bodyHtml || "",
      status: fields.status,
      audience: fields.audience,
      starts_at: emptyToNull(fields.startsAt),
      ends_at: emptyToNull(fields.endsAt),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", announcementId);

  if (error) return { success: false, error: error.message };

  revalidateAnnouncements(announcementId);
  return { success: true };
}

export async function setAnnouncementStatusAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = announcementIdSchema
    .extend({ status: announcementStatusSchema })
    .safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid status update." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.announcementId);

  if (error) return { success: false, error: error.message };

  revalidateAnnouncements(parsed.data.announcementId);
  return { success: true };
}

export async function deleteAnnouncementAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = announcementIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid announcement." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", parsed.data.announcementId);

  if (error) return { success: false, error: error.message };

  revalidateAnnouncements(parsed.data.announcementId);
  return { success: true };
}

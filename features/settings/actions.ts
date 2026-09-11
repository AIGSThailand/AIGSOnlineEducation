"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/courses/permissions";
import { requireAuth } from "@/lib/auth/permissions";
import type { ActionResult } from "@/features/courses/types";
import type { Json } from "@/types/database.types";
import { updateAccountProfileSchema, updatePlatformSettingsSchema } from "./schema";

function revalidateSettings() {
  revalidatePath("/admin/settings");
  revalidatePath("/student/settings");
  revalidatePath("/admin/support");
  revalidatePath("/student/support");
}

async function upsertSetting(
  key: string,
  value: Json,
  updatedBy: string
): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    } as never,
    { onConflict: "key" }
  );
  return error?.message ?? null;
}

export async function updatePlatformSettingsAction(
  input: unknown
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = updatePlatformSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid settings." };
  }

  const {
    siteName,
    supportEmail,
    supportFromName,
    maintenanceMode,
    announcementBannerEnabled,
  } = parsed.data;

  const writes: Array<[string, Json]> = [
    ["site_name", siteName],
    ["support_email", supportEmail ? supportEmail : null],
    ["support_from_name", supportFromName || "AIGS Support"],
    ["maintenance_mode", maintenanceMode],
    ["announcement_banner_enabled", announcementBannerEnabled],
  ];

  for (const [key, value] of writes) {
    const err = await upsertSetting(key, value, admin.id);
    if (err) return { success: false, error: err };
  }

  revalidateSettings();
  return { success: true };
}

export async function updateAccountProfileAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = updateAccountProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid profile." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName || null,
      last_name: parsed.data.lastName || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/student/settings");
  revalidatePath("/student/dashboard");
  return { success: true };
}

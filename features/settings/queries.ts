import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettingKey,
  type PlatformSettingsMap,
} from "./types";

function asString(value: Json | undefined, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: Json | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

function asBoolean(value: Json | undefined, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function getPlatformSettings(): Promise<PlatformSettingsMap> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("key, value")
    .returns<{ key: string; value: Json }[]>();

  if (error) {
    console.error("[getPlatformSettings]", error.message);
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }

  const map = new Map((data || []).map((row) => [row.key, row.value]));

  return {
    site_name: asString(map.get("site_name"), DEFAULT_PLATFORM_SETTINGS.site_name),
    support_email: asStringOrNull(map.get("support_email")),
    support_from_name: asString(
      map.get("support_from_name"),
      DEFAULT_PLATFORM_SETTINGS.support_from_name
    ),
    maintenance_mode: asBoolean(
      map.get("maintenance_mode"),
      DEFAULT_PLATFORM_SETTINGS.maintenance_mode
    ),
    announcement_banner_enabled: asBoolean(
      map.get("announcement_banner_enabled"),
      DEFAULT_PLATFORM_SETTINGS.announcement_banner_enabled
    ),
  };
}

export async function getPlatformSetting(
  key: PlatformSettingKey
): Promise<PlatformSettingsMap[PlatformSettingKey]> {
  const settings = await getPlatformSettings();
  return settings[key];
}

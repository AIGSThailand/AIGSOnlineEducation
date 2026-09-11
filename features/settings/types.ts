export type PlatformSettingKey =
  | "site_name"
  | "support_email"
  | "support_from_name"
  | "maintenance_mode"
  | "announcement_banner_enabled";

export type PlatformSettingsMap = {
  site_name: string;
  support_email: string | null;
  support_from_name: string;
  maintenance_mode: boolean;
  announcement_banner_enabled: boolean;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsMap = {
  site_name: "AIGS Online Education",
  support_email: null,
  support_from_name: "AIGS Support",
  maintenance_mode: false,
  announcement_banner_enabled: true,
};

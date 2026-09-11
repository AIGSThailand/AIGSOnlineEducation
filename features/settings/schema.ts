import { z } from "zod";

export const updatePlatformSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(200),
  supportEmail: z
    .string()
    .trim()
    .email("Enter a valid support email.")
    .optional()
    .or(z.literal("")),
  supportFromName: z.string().trim().max(200).optional().or(z.literal("")),
  maintenanceMode: z.boolean(),
  announcementBannerEnabled: z.boolean(),
});

export const updateAccountProfileSchema = z.object({
  firstName: z.string().trim().max(100).optional().or(z.literal("")),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
});

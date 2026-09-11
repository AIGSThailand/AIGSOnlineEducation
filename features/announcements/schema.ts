import { z } from "zod";

export const announcementStatusSchema = z.enum(["draft", "published", "archived"]);
export const announcementAudienceSchema = z.enum(["all", "students", "instructors", "admins"]);

/** Accept ISO datetime or datetime-local (YYYY-MM-DDTHH:mm). Empty → null. */
const optionalDateTime = z
  .string()
  .optional()
  .nullable()
  .or(z.literal(""))
  .transform((v) => {
    if (!v || v === "") return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  });

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(300),
  bodyHtml: z.string().max(200000).optional().or(z.literal("")),
  status: announcementStatusSchema.optional(),
  audience: announcementAudienceSchema.optional(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
});

export const updateAnnouncementSchema = createAnnouncementSchema.extend({
  announcementId: z.string().uuid(),
});

export const announcementIdSchema = z.object({
  announcementId: z.string().uuid(),
});

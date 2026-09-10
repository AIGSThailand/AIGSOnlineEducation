import { z } from "zod";

export const groupStatusSchema = z.enum(["active", "archived"]);

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens.")
    .optional()
    .or(z.literal("")),
  description: z.string().max(100000).optional().or(z.literal("")),
  status: groupStatusSchema.optional(),
});

export const updateGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(100000).optional().nullable(),
  status: groupStatusSchema.optional(),
  stripeProductId: z.string().trim().max(200).optional().or(z.literal("")),
  stripePriceId: z.string().trim().max(200).optional().or(z.literal("")),
});

export const setGroupCoursesSchema = z.object({
  groupId: z.string().uuid(),
  courseIds: z.array(z.string().uuid()).max(200),
});

export const addGroupMemberSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const removeGroupMemberSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
});

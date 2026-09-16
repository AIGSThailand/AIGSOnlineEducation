import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "instructor", "student"]);

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleSchema,
});

export const adminUserListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.enum(["all", "admin", "instructor", "student"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(10).max(100).optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  firstName: z.string().trim().max(100).optional().or(z.literal("")),
  lastName: z.string().trim().max(100).optional().or(z.literal("")),
  role: userRoleSchema.default("student"),
});

export const userIdSchema = z.object({
  userId: z.string().uuid(),
});

export const setInstructorCoursesSchema = z.object({
  userId: z.string().uuid(),
  courseIds: z.array(z.string().uuid()).max(500),
});

export const setUserBanSchema = z.object({
  userId: z.string().uuid(),
  banned: z.boolean(),
});

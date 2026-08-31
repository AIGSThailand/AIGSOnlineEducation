import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, { message: "First name is required." }),
  lastName: z.string().trim().min(1, { message: "Last name is required." }),
  email: z.string().trim().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  role: z.enum(["student", "instructor"]).default("student"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address." }),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, { message: "Password must be at least 8 characters." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

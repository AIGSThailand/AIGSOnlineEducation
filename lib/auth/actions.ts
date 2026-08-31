"use server";

import { createClient } from "@/lib/supabase/server";
import { getRoleDashboardPath } from "./redirects";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database.types";
import type { AuthActionResult } from "@/types/auth.types";

/**
 * Sign In Server Action
 */
export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validated = loginSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid credentials provided.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Fetch role for redirection
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let redirectPath = "/student/dashboard";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<{ role: UserRole }>();

    redirectPath = getRoleDashboardPath(profile?.role);
  }

  return {
    success: true,
    redirectUrl: redirectPath,
  };
}

/**
 * Sign Up / Registration Server Action
 */
export async function registerAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") || "student",
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid registration data.",
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
      data: {
        first_name: validated.data.firstName,
        last_name: validated.data.lastName,
        role: validated.data.role,
      },
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // If email confirmation is enabled on Supabase, user session may not be active yet
  if (data.user && !data.session) {
    return {
      success: true,
      message: "Registration successful! Please check your email for the confirmation link.",
    };
  }

  const redirectPath = getRoleDashboardPath(validated.data.role as UserRole);
  return {
    success: true,
    redirectUrl: redirectPath,
  };
}

/**
 * Forgot Password Server Action
 */
export async function forgotPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email"),
  };

  const validated = forgotPasswordSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid email address.",
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(validated.data.email, {
    redirectTo: `${origin}/reset-password`,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    message: "Password reset instructions have been sent to your email.",
  };
}

/**
 * Reset Password Server Action
 */
export async function resetPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const rawData = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const validated = resetPasswordSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid password confirmation.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    message: "Password has been successfully updated.",
    redirectUrl: "/login",
  };
}

/**
 * Sign Out Server Action
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

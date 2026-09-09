"use server";

import { createClient } from "@/lib/supabase/server";
import { getClientEnv } from "@/lib/env/client";
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
    // Public registration always creates a student account.
    role: "student",
  };

  const validated = registerSchema.safeParse(rawData);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.errors[0]?.message || "Invalid registration data.",
    };
  }

  const supabase = await createClient();
  const { NEXT_PUBLIC_APP_URL: origin } = getClientEnv();

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
    const msg = error.message.toLowerCase();
    if (
      msg.includes("already registered") ||
      msg.includes("already been registered") ||
      msg.includes("user already exists") ||
      error.code === "user_already_exists"
    ) {
      return {
        success: false,
        error: "An account with this email already exists. Please sign in instead.",
        redirectUrl: `/login?email=${encodeURIComponent(validated.data.email)}&already=1`,
      };
    }
    if (msg.includes("rate limit") || msg.includes("email rate")) {
      return {
        success: false,
        error:
          "Too many signup emails were sent. Please wait a few minutes, or ask an admin to create/confirm your account.",
      };
    }
    if (
      error.code === "email_address_invalid" ||
      (msg.includes("email address") && msg.includes("invalid"))
    ) {
      return {
        success: false,
        error:
          "Supabase Auth rejected this email. With the default mailer, use an email on your Supabase org team, a normal provider address (e.g. Gmail), or turn Confirm email off / add custom SMTP. Test domains and some addresses are blocked.",
      };
    }
    if (
      error.code === "email_address_not_authorized" ||
      msg.includes("not authorized")
    ) {
      return {
        success: false,
        error:
          "This email cannot receive Supabase auth mail on the default SMTP. Add custom SMTP, or use an email that belongs to your Supabase organization.",
      };
    }
    return {
      success: false,
      error: error.message,
    };
  }

  // Supabase may return a user with empty identities when the email already exists
  // (anti-enumeration) while Confirm email is enabled — treat as duplicate.
  const identities = data.user?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    return {
      success: false,
      error: "An account with this email already exists. Please sign in instead.",
      redirectUrl: `/login?email=${encodeURIComponent(validated.data.email)}&already=1`,
    };
  }

  // Email confirmation required — no session yet. Send user to login with guidance.
  if (data.user && !data.session) {
    return {
      success: true,
      message:
        "Account created. Check your email to confirm, then sign in. If you already confirmed, you can sign in now.",
      redirectUrl: `/login?email=${encodeURIComponent(validated.data.email)}&registered=1`,
    };
  }

  // Immediate session (confirm-email off) — go to role dashboard from profile when possible.
  if (data.session && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle<{ role: UserRole }>();

    return {
      success: true,
      redirectUrl: getRoleDashboardPath(profile?.role ?? (validated.data.role as UserRole)),
    };
  }

  return {
    success: false,
    error: "Registration did not complete. Please try again or sign in if you already have an account.",
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
  const { NEXT_PUBLIC_APP_URL: origin } = getClientEnv();

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


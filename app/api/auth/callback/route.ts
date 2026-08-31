import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import type { UserRole } from "@/types/database.types";

/**
 * Auth Callback Route Handler
 * Exchanges auth code for a session (PKCE flow, Email confirmation, Password Reset)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If a specific destination was provided, route there
      if (next !== "/") {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Otherwise, redirect to role-specific dashboard
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single<{ role: UserRole }>();

        const rolePath = getRoleDashboardPath(profile?.role);
        return NextResponse.redirect(`${origin}${rolePath}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/(auth)/auth-code-error`);
}

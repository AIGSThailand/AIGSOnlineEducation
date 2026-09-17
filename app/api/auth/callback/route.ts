import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getClientEnv } from "@/lib/env/client";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import type { Database, UserRole } from "@/types/database.types";

/** Same-origin relative path only (blocks open redirects). */
function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return null;
  }
  return next;
}

/**
 * Auth Callback — exchanges PKCE `code` for a session (email confirm, password reset).
 * Session cookies must be written onto the redirect response.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth-code-error`);
  }

  const cookieStore = cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getClientEnv();

  const pendingCookies: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as CookieOptions);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth-code-error`);
  }

  let destination = next;
  if (!destination) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single<{ role: UserRole }>();
      destination = getRoleDashboardPath(profile?.role);
    } else {
      destination = "/student/dashboard";
    }
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as CookieOptions);
  });
  return response;
}

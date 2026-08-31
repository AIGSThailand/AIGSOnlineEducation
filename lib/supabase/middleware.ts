import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/types/database.types";

/**
 * Middleware session handler: refreshes expired Supabase session cookies
 * and performs role-aware protected route enforcement.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as CookieOptions)
        );
      },
    },
  });

  // IMPORTANT: Do NOT use supabase.auth.getSession() in middleware as it is insecure and not guaranteed to refresh tokens
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Unauthenticated users trying to access protected dashboards
  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/instructor") ||
    pathname.startsWith("/student");

  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated user role verification for role-specific routes
  if (user && isProtectedRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role as UserRole) || "student";

    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = role === "instructor" ? "/instructor/dashboard" : "/student/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/instructor") && role !== "instructor" && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/student/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // 3. Authenticated users attempting to visit auth pages (login/register)
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  if (isAuthRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role as UserRole) || "student";
    const redirectUrl = request.nextUrl.clone();

    if (role === "admin") {
      redirectUrl.pathname = "/admin/dashboard";
    } else if (role === "instructor") {
      redirectUrl.pathname = "/instructor/dashboard";
    } else {
      redirectUrl.pathname = "/student/dashboard";
    }

    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

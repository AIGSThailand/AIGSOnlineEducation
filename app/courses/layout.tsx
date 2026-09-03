import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";

export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const dashboardHref = user ? getRoleDashboardPath(user.profile?.role) : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
              A
            </div>
            <span className="text-lg font-bold text-slate-900">AIGS Courses</span>
          </Link>

          <div className="flex items-center space-x-3">
            {user ? (
              <Link href={dashboardHref}>
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm">Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import { PublicLayout } from "@/components/public/public-layout";

export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <PublicLayout
      dashboardHref={user ? getRoleDashboardPath(user.profile?.role) : undefined}
      mainClassName="flex-1 bg-[var(--surface-muted)]"
    >
      {children}
    </PublicLayout>
  );
}

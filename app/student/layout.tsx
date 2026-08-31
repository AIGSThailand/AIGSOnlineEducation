import { requireRole } from "@/lib/auth/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["student", "instructor", "admin"]);

  return <DashboardShell user={user}>{children}</DashboardShell>;
}

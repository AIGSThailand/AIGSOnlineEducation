import { requireRole } from "@/lib/auth/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole(["admin"]);

  return <DashboardShell user={user}>{children}</DashboardShell>;
}

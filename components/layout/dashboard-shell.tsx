import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { AuthSessionUser } from "@/types/auth.types";
import type { UserRole } from "@/types/database.types";

interface DashboardShellProps {
  user: AuthSessionUser;
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const role = (user.profile?.role as UserRole) || "student";

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

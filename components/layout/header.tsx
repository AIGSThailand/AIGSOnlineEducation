import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import type { AuthSessionUser } from "@/types/auth.types";
import type { UserRole } from "@/types/database.types";

interface HeaderProps {
  user: AuthSessionUser;
}

export function Header({ user }: HeaderProps) {
  const role = (user.profile?.role as UserRole) || "student";

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <div className="flex items-center space-x-3">
        <MobileNav role={role} />
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Welcome back,{" "}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {user.profile?.first_name || user.email.split("@")[0]}
          </span>
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <UserMenu profile={user.profile} email={user.email} />
      </div>
    </header>
  );
}

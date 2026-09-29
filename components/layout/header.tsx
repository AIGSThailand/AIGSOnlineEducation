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
    <header className="relative z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-4 sm:px-6">
      <div className="flex items-center space-x-3">
        <MobileNav role={role} />
        <span className="text-sm text-[var(--text-secondary)]">
          Welcome back,{" "}
          <span className="font-bold text-[var(--text-primary)]">
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

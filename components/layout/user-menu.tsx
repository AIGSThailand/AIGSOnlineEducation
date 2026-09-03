"use client";

import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { getInitials } from "@/lib/utils";
import type { UserProfile } from "@/types/auth.types";
import { LogOut, User as UserIcon, Shield } from "lucide-react";

interface UserMenuProps {
  profile: UserProfile | null;
  email: string;
}

export function UserMenu({ profile, email }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const fullName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ""}`.trim()
    : email;

  const initials = getInitials(profile?.first_name, profile?.last_name);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 rounded-full p-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
          {initials}
        </div>
        <div className="hidden text-left md:block">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{fullName}</p>
          <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
            {profile?.role || "Student"}
          </p>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{fullName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</p>
              <div className="mt-1 flex items-center text-xs font-semibold capitalize text-brand-600 dark:text-brand-400">
                <Shield className="mr-1 h-3.5 w-3.5" />
                {profile?.role || "student"}
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

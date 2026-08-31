"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database.types";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  FileCheck,
  BarChart3,
  Award,
  HelpCircle,
  Settings,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Users & Roles", href: "/admin/users", icon: Users },
    { label: "Courses Management", href: "/admin/courses", icon: BookOpen },
    { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap },
    { label: "System Reports", href: "/admin/reports", icon: BarChart3 },
  ],
  instructor: [
    { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
    { label: "My Courses", href: "/instructor/courses", icon: BookOpen },
    { label: "Enrolled Students", href: "/instructor/students", icon: Users },
    { label: "Assignments", href: "/instructor/assignments", icon: FileCheck },
    { label: "Quizzes", href: "/instructor/quizzes", icon: HelpCircle },
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "My Learning", href: "/student/courses", icon: BookOpen },
    { label: "Course Catalog", href: "/courses", icon: GraduationCap },
    { label: "Assignments", href: "/student/assignments", icon: FileCheck },
    { label: "Grades & Progress", href: "/student/grades", icon: BarChart3 },
    { label: "Certificates", href: "/student/certificates", icon: Award },
  ],
};

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = roleNavItems[role] || roleNavItems.student;

  return (
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
      {/* Brand Logo */}
      <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-lg">
            A
          </div>
          <span className="text-base font-bold text-slate-900 dark:text-white">
            AIGS Education
          </span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex flex-1 flex-col justify-between overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {role} Portal
          </div>
          {items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <Icon className={cn("mr-3 h-5 w-5", isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer info / Version */}
        <div className="px-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400">
            AIGS Platform v0.1.0
          </div>
        </div>
      </div>
    </aside>
  );
}

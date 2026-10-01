"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/public/brand-logo";
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
  Layers,
  Megaphone,
  LifeBuoy,
  Mail,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const roleNavItems: Record<UserRole, NavItem[]> = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Lesson Questions", href: "/admin/questions", icon: HelpCircle },
    { label: "Users & Roles", href: "/admin/users", icon: Users },
    { label: "Courses Management", href: "/admin/courses", icon: BookOpen },
    { label: "Assignments", href: "/admin/assignments", icon: FileCheck },
    { label: "Quizzes", href: "/admin/quizzes", icon: HelpCircle },
    { label: "Groups & Bundles", href: "/admin/groups", icon: Layers },
    { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap },
    { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { label: "Support", href: "/admin/support", icon: LifeBuoy },
    { label: "Certificates", href: "/admin/certificates", icon: Award },
    { label: "System Reports", href: "/admin/reports", icon: BarChart3 },
    { label: "Settings", href: "/admin/settings", icon: Settings },
    { label: "Email", href: "/admin/settings/email", icon: Mail },
  ],
  instructor: [
    { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
    { label: "Lesson Questions", href: "/instructor/questions", icon: HelpCircle },
    { label: "My Courses", href: "/instructor/courses", icon: BookOpen },
    { label: "Enrolled Students", href: "/instructor/students", icon: Users },
    { label: "Assignments", href: "/instructor/assignments", icon: FileCheck },
    { label: "Quizzes", href: "/instructor/quizzes", icon: HelpCircle },
    { label: "Announcements", href: "/student/announcements", icon: Megaphone },
    { label: "Support", href: "/student/support", icon: LifeBuoy },
    { label: "Settings", href: "/student/settings", icon: Settings },
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { label: "My Learning", href: "/student/courses", icon: BookOpen },
    { label: "Course Catalog", href: "/courses", icon: GraduationCap },
    { label: "Assignments", href: "/student/assignments", icon: FileCheck },
    { label: "Grades & Progress", href: "/student/grades", icon: BarChart3 },
    { label: "Certificates", href: "/student/certificates", icon: Award },
    { label: "Announcements", href: "/student/announcements", icon: Megaphone },
    { label: "Support", href: "/student/support", icon: LifeBuoy },
    { label: "Settings", href: "/student/settings", icon: Settings },
  ],
};

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = roleNavItems[role] || roleNavItems.student;

  return (
    <aside className="hidden min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-white md:flex">
      <div className="flex h-16 shrink-0 items-center border-b border-[var(--border)] px-5">
        <Link href="/">
          <BrandLogo className="h-8" />
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <nav className="space-y-1">
          <div className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            {role}
          </div>
          {items.map((item) => {
            const isActive =
              item.href === "/admin/settings"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors",
                  isActive
                    ? "bg-[var(--brand-chrome)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <Icon
                  className={cn("mr-3 h-4 w-4", isActive ? "text-white" : "text-[var(--text-secondary)]")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Keep version info visible while navigation scrolls on short screens. */}
      <footer className="shrink-0 border-t border-[var(--border)] px-5 py-4">
        <div className="text-xs text-[var(--text-secondary)]">AIGS Platform v0.1.0</div>
      </footer>
    </aside>
  );
}

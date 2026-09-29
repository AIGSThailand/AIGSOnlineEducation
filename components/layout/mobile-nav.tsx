"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database.types";
import {
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  FileCheck,
  BarChart3,
  Award,
  HelpCircle,
  Layers,
  Megaphone,
  LifeBuoy,
  Mail,
  Settings,
} from "lucide-react";

interface MobileNavProps {
  role: UserRole;
}

export function MobileNav({ role }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems =
    {
      admin: [
        { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { label: "Users & Roles", href: "/admin/users", icon: Users },
        { label: "Courses", href: "/admin/courses", icon: BookOpen },
        { label: "Groups & Bundles", href: "/admin/groups", icon: Layers },
        { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap },
        { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { label: "Support", href: "/admin/support", icon: LifeBuoy },
        { label: "Certificates", href: "/admin/certificates", icon: Award },
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
        { label: "Settings", href: "/admin/settings", icon: Settings },
        { label: "Email", href: "/admin/settings/email", icon: Mail },
      ],
      instructor: [
        { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
        { label: "Courses", href: "/instructor/courses", icon: BookOpen },
        { label: "Students", href: "/instructor/students", icon: Users },
        { label: "Assignments", href: "/instructor/assignments", icon: FileCheck },
        { label: "Quizzes", href: "/instructor/quizzes", icon: HelpCircle },
        { label: "Announcements", href: "/student/announcements", icon: Megaphone },
        { label: "Support", href: "/student/support", icon: LifeBuoy },
        { label: "Settings", href: "/student/settings", icon: Settings },
      ],
      student: [
        { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
        { label: "My Courses", href: "/student/courses", icon: BookOpen },
        { label: "Catalog", href: "/courses", icon: GraduationCap },
        { label: "Assignments", href: "/student/assignments", icon: FileCheck },
        { label: "Grades", href: "/student/grades", icon: BarChart3 },
        { label: "Certificates", href: "/student/certificates", icon: Award },
        { label: "Announcements", href: "/student/announcements", icon: Megaphone },
        { label: "Support", href: "/student/support", icon: LifeBuoy },
        { label: "Settings", href: "/student/settings", icon: Settings },
      ],
    }[role] || [];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-sm p-2 text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
        aria-label="Toggle navigation menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-[var(--border)] bg-white p-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wide",
                    isActive
                      ? "bg-[var(--brand-chrome)] text-white"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className={cn("mr-3 h-4 w-4", isActive ? "text-white" : "text-[var(--text-secondary)]")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

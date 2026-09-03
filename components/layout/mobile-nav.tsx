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
        { label: "Enrollments", href: "/admin/enrollments", icon: GraduationCap },
        { label: "Reports", href: "/admin/reports", icon: BarChart3 },
      ],
      instructor: [
        { label: "Dashboard", href: "/instructor/dashboard", icon: LayoutDashboard },
        { label: "Courses", href: "/instructor/courses", icon: BookOpen },
        { label: "Students", href: "/instructor/students", icon: Users },
        { label: "Assignments", href: "/instructor/assignments", icon: FileCheck },
        { label: "Quizzes", href: "/instructor/quizzes", icon: HelpCircle },
      ],
      student: [
        { label: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
        { label: "My Courses", href: "/student/courses", icon: BookOpen },
        { label: "Catalog", href: "/courses", icon: GraduationCap },
        { label: "Assignments", href: "/student/assignments", icon: FileCheck },
        { label: "Grades", href: "/student/grades", icon: BarChart3 },
        { label: "Certificates", href: "/student/certificates", icon: Award },
      ],
    }[role] || [];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="Toggle navigation menu"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 top-16 z-50 border-b border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
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
                    "flex items-center rounded-md px-3 py-2 text-sm font-medium",
                    isActive
                      ? "dark:bg-brand-950 bg-brand-50 font-semibold text-brand-700 dark:text-brand-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  <Icon className="mr-3 h-5 w-5 text-brand-600" />
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

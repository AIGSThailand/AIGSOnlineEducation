"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CheckCircle, Circle, PlayCircle } from "lucide-react";
import type { ModuleWithLessons } from "@/types/lms.types";

interface LessonSidebarProps {
  courseId: string;
  modules: ModuleWithLessons[];
  currentLessonId?: string;
  completedLessonIds?: string[];
}

export function LessonSidebar({
  courseId,
  modules,
  currentLessonId,
  completedLessonIds = [],
}: LessonSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">
        Course Syllabus
      </h3>

      <div className="space-y-4">
        {modules.map((module) => (
          <div key={module.id} className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {module.title}
            </h4>

            <div className="space-y-0.5">
              {module.lessons.map((lesson) => {
                const isActive =
                  currentLessonId === lesson.id || pathname.includes(`/lessons/${lesson.id}`);
                const isCompleted = completedLessonIds.includes(lesson.id);

                return (
                  <Link
                    key={lesson.id}
                    href={`/courses/${courseId}/lessons/${lesson.id}`}
                    className={cn(
                      "flex items-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                      isActive
                        ? "dark:bg-brand-950 bg-brand-50 font-semibold text-brand-700 dark:text-brand-300"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="mr-2 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    ) : isActive ? (
                      <PlayCircle className="mr-2 h-4 w-4 flex-shrink-0 text-brand-600" />
                    ) : (
                      <Circle className="mr-2 h-4 w-4 flex-shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BookOpen, User } from "lucide-react";
import type { CourseWithInstructors } from "@/types/lms.types";
import type { Database } from "@/types/database.types";

type CourseCardData =
  | CourseWithInstructors
  | Database["public"]["Tables"]["courses"]["Row"];

interface CourseCardProps {
  course: CourseCardData;
  isEnrolled?: boolean;
}

export function CourseCard({ course, isEnrolled }: CourseCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md p-0">
      {course.thumbnail_url ? (
        <div className="aspect-video w-full overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-brand-50 text-brand-600">
          <BookOpen className="h-10 w-10" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between">
          <Badge variant={course.status === "published" ? "success" : "default"}>
            {course.status}
          </Badge>
          {isEnrolled && <Badge variant="default">Enrolled</Badge>}
        </div>

        <h4 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
          {course.title}
        </h4>

        <p className="mb-4 flex-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {course.description || "No description provided."}
        </p>

        {"instructors" in course && course.instructors && course.instructors.length > 0 && (
          <div className="mb-4 flex items-center text-xs text-slate-500">
            <User className="mr-1 h-3.5 w-3.5 text-slate-400" />
            <span>
              {course.instructors
                .map((inst) => `${inst.first_name || ""} ${inst.last_name || ""}`.trim())
                .filter(Boolean)
                .join(", ") || "Instructor"}
            </span>
          </div>
        )}

        <div className="mt-auto border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            href={`/courses/${course.id}`}
            className="inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            {isEnrolled ? "Continue Course" : "View Course"}
          </Link>
        </div>
      </div>
    </Card>
  );
}

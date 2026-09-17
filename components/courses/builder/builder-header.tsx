"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Menu, PanelRight, Save } from "lucide-react";
import type { BuilderPortal, CourseBuilderCourse, SaveStatus } from "@/features/courses/types";

interface BuilderHeaderProps {
  portal: BuilderPortal;
  course: CourseBuilderCourse;
  saveStatus: SaveStatus;
  structureSource?: "course_sections" | "modules_fallback";
  onPublish: () => void;
  onArchive: () => void;
  onSave?: () => void;
  onOpenStructure: () => void;
  onOpenSettings: () => void;
  canPublish?: boolean;
}

const saveStatusLabel: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
  unsaved: "Unsaved changes",
};

export function BuilderHeader({
  portal,
  course,
  saveStatus,
  structureSource,
  onPublish,
  onArchive,
  onSave,
  onOpenStructure,
  onOpenSettings,
  canPublish = true,
}: BuilderHeaderProps) {
  const statusText = saveStatusLabel[saveStatus];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
        <Link
          href={`/${portal}/courses`}
          className="inline-flex items-center gap-1 rounded-md px-1 text-sm text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Courses</span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 lg:hidden"
            onClick={onOpenStructure}
            aria-label="Open course structure"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
            {course.title}
          </h1>
          <Badge variant={course.status === "published" ? "success" : "default"}>
            {course.status}
          </Badge>
          {structureSource === "course_sections" && course.wordpressCourseId != null && (
            <Badge variant="default" className="hidden sm:inline-flex">
              LearnDash
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {statusText && (
            <span
              className={`text-xs ${
                saveStatus === "error"
                  ? "text-red-600"
                  : saveStatus === "saved"
                    ? "text-green-600"
                    : "text-slate-500"
              }`}
              aria-live="polite"
            >
              {statusText}
            </span>
          )}

          <details className="relative">
            <summary className="flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"><Eye className="mr-1.5 h-4 w-4" />Preview as…</summary>
            <div className="absolute right-0 z-40 mt-2 w-56 space-y-2 rounded-md border bg-white p-3 shadow-lg">
              <Link className="block text-sm underline" href={`/courses/${course.id}/preview`} target="_blank" rel="noopener noreferrer">Staff draft preview</Link>
              <Link className="block text-sm underline" href={`/courses/${course.id}/preview?audience=visitor`} target="_blank" rel="noopener noreferrer">Visitor / before enrollment</Link>
              <p className="text-xs text-slate-500">Preview uses saved content. Student progress should be verified with a test student account.</p>
            </div>
          </details>

          {onSave && (
            <Button type="button" variant="secondary" size="sm" onClick={onSave}>
              <Save className="mr-1.5 h-4 w-4" />
              Save
            </Button>
          )}

          {course.status === "draft" && canPublish && (
            <Button type="button" size="sm" onClick={onPublish} disabled={["saving", "unsaved", "error"].includes(saveStatus)}>
              Publish
            </Button>
          )}

          {course.status === "published" && canPublish && (
            <Button type="button" variant="outline" size="sm" onClick={onArchive}>
              Archive
            </Button>
          )}

          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 xl:hidden"
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <PanelRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

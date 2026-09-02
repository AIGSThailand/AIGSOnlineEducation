"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateCourseAction } from "@/features/courses/actions";
import type { CourseBuilderCourse, SaveStatus } from "@/features/courses/types";

interface CourseDetailsFormProps {
  course: CourseBuilderCourse;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

export function CourseDetailsForm({
  course,
  onSaveStatusChange,
  saveSignal,
}: CourseDetailsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(course.title);
  const [slug, setSlug] = useState(course.slug);
  const [description, setDescription] = useState(course.description || "");
  const [excerpt, setExcerpt] = useState(course.excerpt || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(course.title);
    setSlug(course.slug);
    setDescription(course.description || "");
    setExcerpt(course.excerpt || "");
  }, [course]);

  const handleSave = () => {
    onSaveStatusChange("saving");
    setError(null);
    startTransition(async () => {
      const result = await updateCourseAction({
        courseId: course.id,
        title,
        slug,
        description,
        excerpt,
      });
      if (result.success) {
        onSaveStatusChange("saved");
        router.refresh();
      } else {
        setError(result.error);
        onSaveStatusChange("error");
      }
    });
  };

  useEffect(() => {
    if (saveSignal && saveSignal > 0) handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Course details</h2>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="course-title">Title</Label>
          <Input
            id="course-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="course-slug">Slug</Label>
          <Input
            id="course-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="course-excerpt">Short description</Label>
          <Textarea
            id="course-excerpt"
            value={excerpt}
            rows={3}
            onChange={(e) => {
              setExcerpt(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="course-description">Full description</Label>
          <Textarea
            id="course-description"
            value={description}
            rows={10}
            onChange={(e) => {
              setDescription(e.target.value);
              onSaveStatusChange("unsaved");
            }}
            placeholder="HTML or plain text. Rich editor can be added later."
          />
          <p className="mt-1 text-xs text-slate-500">
            Supports HTML for migrated LearnDash content. Content is stored as-is and sanitized on
            display.
          </p>
        </div>
      </div>

      <Button type="button" onClick={handleSave} isLoading={isPending}>
        Save course details
      </Button>
    </div>
  );
}

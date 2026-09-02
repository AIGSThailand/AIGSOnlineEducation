"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getLessonForEdit, updateLessonAction } from "@/features/courses/builder/actions";
import type { SaveStatus } from "@/features/courses/types";
import { Skeleton } from "@/components/ui/skeleton";

interface LessonEditorProps {
  courseId: string;
  lessonId: string;
  moduleId: string;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

export function LessonEditor({
  courseId,
  lessonId,
  moduleId,
  onSaveStatusChange,
  saveSignal,
}: LessonEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [hasProgress, setHasProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getLessonForEdit(courseId, lessonId).then((result) => {
      if (result.success && result.data) {
        setTitle(result.data.title);
        setSlug(result.data.slug);
        setContent(result.data.content || "");
        setVideoUrl(result.data.videoUrl || "");
        setStatus(result.data.status as "draft" | "published" | "archived");
        setHasProgress(result.data.hasProgress);
      } else {
        setError(result.success ? "Lesson not found." : result.error);
      }
      setLoading(false);
    });
  }, [courseId, lessonId]);

  const handleSave = () => {
    onSaveStatusChange("saving");
    setError(null);
    startTransition(async () => {
      const result = await updateLessonAction({
        courseId,
        moduleId,
        lessonId,
        title,
        slug,
        content,
        videoUrl,
        status,
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lesson</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Edit lesson</h2>
        {hasProgress && (
          <p className="mt-2 text-sm text-amber-700">
            This lesson has student progress. Edits are allowed; deletion is restricted.
          </p>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="lesson-title">Title</Label>
          <Input
            id="lesson-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="lesson-slug">Slug</Label>
          <Input
            id="lesson-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="lesson-video">Video URL</Label>
          <Input
            id="lesson-video"
            type="url"
            value={videoUrl}
            placeholder="https://..."
            onChange={(e) => {
              setVideoUrl(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="lesson-status">Status</Label>
          <Select
            id="lesson-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "draft" | "published" | "archived");
              onSaveStatusChange("unsaved");
            }}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="lesson-content">Content</Label>
          <Textarea
            id="lesson-content"
            value={content}
            rows={14}
            onChange={(e) => {
              setContent(e.target.value);
              onSaveStatusChange("unsaved");
            }}
            placeholder="Lesson notes, HTML, or supplementary content."
          />
        </div>
      </div>

      <Button type="button" onClick={handleSave} isLoading={isPending}>
        Save lesson
      </Button>
    </div>
  );
}

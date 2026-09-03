"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/courses/builder/rich-text-editor";
import { getLessonForEdit, updateLessonAction } from "@/features/courses/builder/actions";
import type { SaveStatus } from "@/features/courses/types";

const AUTOSAVE_MS = 1200;

interface LessonEditorProps {
  courseId: string;
  lessonId: string;
  moduleId: string;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

type LessonForm = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  videoUrl: string;
  status: "draft" | "published" | "archived";
};

export function LessonEditor({
  courseId,
  lessonId,
  moduleId,
  onSaveStatusChange,
  saveSignal,
}: LessonEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LessonForm>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    videoUrl: "",
    status: "draft",
  });
  const [hasProgress, setHasProgress] = useState(false);
  const [wordpressLessonId, setWordpressLessonId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const formRef = useRef(form);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moduleIdRef = useRef(moduleId);

  formRef.current = form;
  dirtyRef.current = dirty;
  moduleIdRef.current = moduleId;

  const persist = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const current = formRef.current;
      if (!current.title.trim() || !current.slug.trim()) {
        return { success: false as const, error: "Title and slug are required." };
      }

      setIsSaving(true);
      onSaveStatusChange("saving");
      setError(null);

      const result = await updateLessonAction({
        courseId,
        moduleId: moduleIdRef.current,
        lessonId,
        title: current.title,
        slug: current.slug,
        content: current.content,
        excerpt: current.excerpt,
        videoUrl: current.videoUrl,
        status: current.status,
      });

      setIsSaving(false);

      if (result.success) {
        setDirty(false);
        dirtyRef.current = false;
        onSaveStatusChange("saved");
        if (opts?.refresh) router.refresh();
      } else {
        setError(result.error);
        onSaveStatusChange("error");
      }
      return result;
    },
    [courseId, lessonId, onSaveStatusChange, router]
  );

  const scheduleAutosave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!dirtyRef.current) return;
      startTransition(() => {
        void persist();
      });
    }, AUTOSAVE_MS);
  }, [persist]);

  const patchForm = useCallback(
    (patch: Partial<LessonForm>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      setDirty(true);
      dirtyRef.current = true;
      onSaveStatusChange("unsaved");
      scheduleAutosave();
    },
    [onSaveStatusChange, scheduleAutosave]
  );

  useEffect(() => {
    setLoading(true);
    setDirty(false);
    dirtyRef.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    getLessonForEdit(courseId, lessonId).then((result) => {
      if (result.success && result.data) {
        setForm({
          title: result.data.title,
          slug: result.data.slug,
          content: result.data.content || "",
          excerpt: result.data.excerpt || "",
          videoUrl: result.data.videoUrl || "",
          status: result.data.status as "draft" | "published" | "archived",
        });
        setHasProgress(result.data.hasProgress);
        setWordpressLessonId(result.data.wordpressLessonId);
        setError(null);
        onSaveStatusChange("idle");
      } else {
        setError(result.success ? "Lesson not found." : result.error);
      }
      setLoading(false);
    });

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [courseId, lessonId, onSaveStatusChange]);

  useEffect(() => {
    if (!saveSignal || saveSignal <= 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    startTransition(() => {
      void persist({ refresh: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lesson</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Edit lesson</h2>
          {hasProgress && (
            <p className="mt-2 text-sm text-amber-700">
              This lesson has student progress. Edits are allowed; deletion is restricted.
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          {isSaving ? "Saving…" : dirty ? "Unsaved changes" : "Autosave on"}
        </p>
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
            value={form.title}
            onChange={(e) => patchForm({ title: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="lesson-slug">Slug</Label>
          <Input
            id="lesson-slug"
            value={form.slug}
            onChange={(e) => patchForm({ slug: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="lesson-content">Content</Label>
          <p className="mb-2 text-xs text-slate-500">
            Migrated LearnDash HTML is editable visually. Use HTML source for unsupported markup.
          </p>
          <RichTextEditor
            value={form.content}
            onChange={(html) => patchForm({ content: html })}
            placeholder="Lesson content — headings, lists, links, images…"
          />
        </div>

        <details className="rounded-lg border border-slate-200 bg-white open:pb-4">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-800">
            Lesson settings
          </summary>
          <div className="space-y-4 border-t border-slate-100 px-4 pt-4">
            <div>
              <Label htmlFor="lesson-video">Video URL</Label>
              <Input
                id="lesson-video"
                type="url"
                value={form.videoUrl}
                placeholder="https://www.youtube.com/embed/…"
                onChange={(e) => patchForm({ videoUrl: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lesson-excerpt">Short excerpt</Label>
              <Textarea
                id="lesson-excerpt"
                value={form.excerpt}
                rows={3}
                maxLength={500}
                placeholder="Optional short summary shown in catalogs."
                onChange={(e) => patchForm({ excerpt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lesson-status">Status</Label>
              <Select
                id="lesson-status"
                value={form.status}
                onChange={(e) =>
                  patchForm({ status: e.target.value as "draft" | "published" | "archived" })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
            {wordpressLessonId != null && (
              <p className="text-xs text-slate-500">
                LearnDash lesson ID: <span className="font-mono">{wordpressLessonId}</span> (read-only)
              </p>
            )}
          </div>
        </details>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            startTransition(() => {
              void persist({ refresh: true });
            });
          }}
          isLoading={isSaving}
        >
          Save lesson
        </Button>
        <span className="text-xs text-slate-400">Autosaves ~1s after you stop typing</span>
      </div>
    </div>
  );
}

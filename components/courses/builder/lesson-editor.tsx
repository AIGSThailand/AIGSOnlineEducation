"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet } from "@/components/ui/sheet";
import { RichTextEditor } from "@/components/courses/builder/rich-text-editor";import { LessonMediaEditor, type LessonMediaFields } from "./lesson/lesson-media-editor";
import { LessonResourcesEditor } from "./lesson/lesson-resources-editor";
import {
  LessonLearningSettings,
  type LessonLearningFields,
} from "./lesson/lesson-learning-settings";
import { LessonMigrationInfo } from "./lesson/lesson-migration-info";
import {
  getLessonForEdit,
  updateLessonContentAction,
  type LessonResourceForEdit,
} from "@/features/lessons/actions";
import { uploadCourseMedia } from "@/features/media/upload-client";
import type { SaveStatus } from "@/features/courses/types";
import { cn } from "@/lib/utils";

const AUTOSAVE_MS = 1000;

type TabId = "content" | "resources" | "settings" | "history";

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
  excerpt: string;
  contentHtml: string;
  contentJson: JSONContent | null;
  media: LessonMediaFields;
  learning: LessonLearningFields;
};

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function LessonEditor({
  courseId,
  lessonId,
  moduleId,
  onSaveStatusChange,
  saveSignal,
}: LessonEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<TabId>("content");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LessonForm>({
    title: "",
    slug: "",
    excerpt: "",
    contentHtml: "",
    contentJson: null,
    media: {
      videoProvider: "",
      videoUrl: "",
      videoId: "",
      videoDurationSeconds: "",
      videoThumbnailUrl: "",
      videoTranscript: "",
      videoCaptionsUrl: "",
    },
    learning: {
      estimatedDurationMinutes: "",
      isRequired: true,
      completionType: "manual",
      videoWatchPercentage: "90",
      dripType: "immediate",
      dripDays: "",
      dripFixedDate: "",
      status: "draft",
      featuredImageUrl: "",
    },
  });
  const [resources, setResources] = useState<LessonResourceForEdit[]>([]);
  const [meta, setMeta] = useState({
    hasProgress: false,
    wordpressLessonId: null as number | null,
    createdAt: null as string | null,
    updatedAt: null as string | null,
    sourceContentHtml: null as string | null,
    hasSourceHtmlWarning: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [featuredBusy, setFeaturedBusy] = useState(false);

  const formRef = useRef(form);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moduleIdRef = useRef(moduleId);
  const requestIdRef = useRef(0);

  const reloadResources = useCallback(async () => {
    const result = await getLessonForEdit(courseId, lessonId);
    if (result.success && result.data) {
      setResources(result.data.resources);
    }
  }, [courseId, lessonId]);

  formRef.current = form;
  dirtyRef.current = dirty;
  moduleIdRef.current = moduleId;

  const buildPayload = useCallback(() => {
    const current = formRef.current;
    const dripValue: Record<string, unknown> = {};
    if (current.learning.dripType === "days_after_enrollment") {
      const days = parseOptionalInt(current.learning.dripDays);
      if (days != null) dripValue.days = days;
    }
    if (current.learning.dripType === "fixed_date" && current.learning.dripFixedDate) {
      dripValue.date = current.learning.dripFixedDate;
    }

    const completionSettings: Record<string, unknown> = {};
    if (current.learning.completionType === "video_watch") {
      const pct = parseOptionalInt(current.learning.videoWatchPercentage) ?? 90;
      completionSettings.videoWatchPercentage = pct;
    }

    // TipTap getJSON() can produce non-plain objects; Server Actions require JSON-serializable plains.
    const contentJson = current.contentJson
      ? (JSON.parse(JSON.stringify(current.contentJson)) as Record<string, unknown>)
      : null;

    return {
      courseId,
      lessonId,
      moduleId: moduleIdRef.current || null,
      title: current.title,
      slug: current.slug,
      excerpt: current.excerpt,
      contentHtml: current.contentHtml,
      contentJson,
      featuredImageUrl: current.learning.featuredImageUrl || null,
      estimatedDurationMinutes: parseOptionalInt(current.learning.estimatedDurationMinutes),
      videoProvider: current.media.videoProvider || null,
      videoUrl: current.media.videoUrl || null,
      videoId: current.media.videoId || null,
      videoDurationSeconds: parseOptionalInt(current.media.videoDurationSeconds),
      videoThumbnailUrl: current.media.videoThumbnailUrl || null,
      videoTranscript: current.media.videoTranscript || null,
      videoCaptionsUrl: current.media.videoCaptionsUrl || null,
      isRequired: current.learning.isRequired,
      completionType: current.learning.completionType,
      completionSettings,
      dripType: current.learning.dripType,
      dripValue,
      status: current.learning.status,
    };
  }, [courseId, lessonId]);

  const persist = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const current = formRef.current;
      if (!current.title.trim() || !current.slug.trim()) {
        return { success: false as const, error: "Title and slug are required." };
      }

      setIsSaving(true);
      onSaveStatusChange("saving");
      setError(null);

      const result = await updateLessonContentAction(buildPayload());

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
    [buildPayload, onSaveStatusChange, router]
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

  const markDirty = useCallback(() => {
    setDirty(true);
    dirtyRef.current = true;
    onSaveStatusChange("unsaved");
    scheduleAutosave();
  }, [onSaveStatusChange, scheduleAutosave]);

  const patchForm = useCallback(
    (updater: (prev: LessonForm) => LessonForm) => {
      setForm((prev) => {
        const next = updater(prev);
        formRef.current = next;
        return next;
      });
      markDirty();
    },
    [markDirty]
  );

  const reload = useCallback(
    async (token: number) => {
      const result = await getLessonForEdit(courseId, lessonId);
      if (token !== requestIdRef.current) return false;

      if (result.success && result.data) {
        const drip = result.data.dripValue || {};
        const completion = result.data.completionSettings || {};
        const next: LessonForm = {
          title: result.data.title,
          slug: result.data.slug,
          excerpt: result.data.excerpt || "",
          contentHtml: result.data.contentHtml || "",
          contentJson: (result.data.contentJson as JSONContent | null) || null,
          media: {
            videoProvider: (result.data.videoProvider as LessonMediaFields["videoProvider"]) || "",
            videoUrl: result.data.videoUrl || "",
            videoId: result.data.videoId || "",
            videoDurationSeconds:
              result.data.videoDurationSeconds != null
                ? String(result.data.videoDurationSeconds)
                : "",
            videoThumbnailUrl: result.data.videoThumbnailUrl || "",
            videoTranscript: result.data.videoTranscript || "",
            videoCaptionsUrl: result.data.videoCaptionsUrl || "",
          },
          learning: {
            estimatedDurationMinutes:
              result.data.estimatedDurationMinutes != null
                ? String(result.data.estimatedDurationMinutes)
                : "",
            isRequired: result.data.isRequired,
            completionType: result.data.completionType as LessonLearningFields["completionType"],
            videoWatchPercentage: String(
              (completion.videoWatchPercentage as number | undefined) ?? 90
            ),
            dripType: result.data.dripType as LessonLearningFields["dripType"],
            dripDays: drip.days != null ? String(drip.days) : "",
            dripFixedDate: typeof drip.date === "string" ? drip.date : "",
            status: result.data.status as LessonLearningFields["status"],
            featuredImageUrl: result.data.featuredImageUrl || "",
          },
        };
        setForm(next);
        formRef.current = next;
        setResources(result.data.resources);
        setMeta({
          hasProgress: result.data.hasProgress,
          wordpressLessonId: result.data.wordpressLessonId,
          createdAt: result.data.createdAt,
          updatedAt: result.data.updatedAt,
          sourceContentHtml: result.data.sourceContentHtml,
          hasSourceHtmlWarning: result.data.hasSourceHtmlWarning,
        });
        setError(null);
        return true;
      }

      setError(result.success ? "Lesson not found." : result.error);
      return false;
    },
    [courseId, lessonId]
  );

  useEffect(() => {
    setLoading(true);
    setDirty(false);
    dirtyRef.current = false;
    setTab("content");
    if (saveTimer.current) clearTimeout(saveTimer.current);

    const token = ++requestIdRef.current;
    void reload(token).finally(() => {
      if (token === requestIdRef.current) {
        setLoading(false);
        onSaveStatusChange("idle");
      }
    });

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [courseId, lessonId, onSaveStatusChange, reload]);

  useEffect(() => {
    if (!saveSignal || saveSignal <= 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    startTransition(() => {
      void persist({ refresh: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  async function handleFeaturedUpload(file: File) {
    setFeaturedBusy(true);
    try {
      const { publicUrl } = await uploadCourseMedia({
        courseId,
        kind: "lesson-image",
        file,
      });
      patchForm((prev) => ({
        ...prev,
        learning: { ...prev.learning, featuredImageUrl: publicUrl },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Featured image upload failed.");
    } finally {
      setFeaturedBusy(false);
    }
  }

  const settingsPanel = (
    <div className="space-y-8">
      <LessonLearningSettings
        value={form.learning}
        onChange={(patch) =>
          patchForm((prev) => ({
            ...prev,
            learning: { ...prev.learning, ...patch },
          }))
        }
        onFeaturedUpload={handleFeaturedUpload}
        onFeaturedRemove={() =>
          patchForm((prev) => ({
            ...prev,
            learning: { ...prev.learning, featuredImageUrl: "" },
          }))
        }
        featuredBusy={featuredBusy}
      />
      <LessonMigrationInfo
        wordpressLessonId={meta.wordpressLessonId}
        createdAt={meta.createdAt}
        updatedAt={meta.updatedAt}
        hasSourceHtml={Boolean(meta.sourceContentHtml)}
      />
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "content", label: "Content" },
    { id: "resources", label: "Resources" },
    { id: "settings", label: "Settings" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lesson</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {form.title || "Edit lesson"}
          </h2>
          <p className="mt-1 text-sm capitalize text-slate-500">
            {form.learning.status}
            {meta.hasProgress ? " · Has student progress" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500" aria-live="polite">
            {isSaving
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : error
                  ? "Save failed"
                  : "Saved"}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="lg:hidden"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
          <Button
            size="sm"
            disabled={isSaving || !dirty}
            onClick={() => {
              if (saveTimer.current) clearTimeout(saveTimer.current);
              startTransition(() => {
                void persist({ refresh: true });
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {meta.hasSourceHtmlWarning && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This lesson has preserved LearnDash source HTML that may differ from the visual editor.
          Use HTML source mode if unsupported markup is missing. Source HTML is never overwritten.
        </p>
      )}

      <div
        className="flex gap-1 border-b border-slate-200"
        role="tablist"
        aria-label="Lesson editor sections"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              "px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900",
              tab === t.id && "border-b-2 border-brand-600 text-brand-800"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-6">
          {tab === "content" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="lesson-title">Title</Label>
                  <Input
                    id="lesson-title"
                    value={form.title}
                    onChange={(e) =>
                      patchForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="lesson-slug">Slug</Label>
                  <Input
                    id="lesson-slug"
                    value={form.slug}
                    onChange={(e) =>
                      patchForm((prev) => ({ ...prev, slug: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="lesson-excerpt">Summary</Label>
                  <Textarea
                    id="lesson-excerpt"
                    rows={2}
                    maxLength={500}
                    value={form.excerpt}
                    onChange={(e) =>
                      patchForm((prev) => ({ ...prev, excerpt: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Content</Label>
                <p className="mb-2 text-xs text-slate-500">
                  TipTap visual editing with HTML source for migrated LearnDash markup.
                </p>
                <RichTextEditor
                  value={form.contentHtml}
                  jsonValue={form.contentJson}
                  onChange={({ html, json }) =>
                    patchForm((prev) => ({
                      ...prev,
                      contentHtml: html,
                      contentJson: json,
                    }))
                  }
                  courseId={courseId}
                />
              </div>

              <LessonMediaEditor
                value={form.media}
                onChange={(patch) =>
                  patchForm((prev) => ({
                    ...prev,
                    media: { ...prev.media, ...patch },
                  }))
                }
              />
            </>
          )}

          {tab === "resources" && (
            <LessonResourcesEditor
              courseId={courseId}
              lessonId={lessonId}
              resources={resources}
              onChanged={() => void reloadResources()}
            />
          )}
          {tab === "settings" && <div className="lg:hidden">{settingsPanel}</div>}

          {tab === "history" && (
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Version history</h3>
              <p className="mt-2 text-sm text-slate-500">
                Lesson revisions are planned for a later phase. Autosave does not create revision
                snapshots.
              </p>
            </div>
          )}

          {tab === "settings" && (
            <div className="hidden lg:block">
              <p className="text-sm text-slate-500">
                Use the right panel for publishing, learning, drip, and migration metadata.
              </p>
            </div>
          )}
        </div>

        <aside className="hidden rounded-lg border border-slate-200 bg-slate-50 p-4 lg:block">
          {settingsPanel}
        </aside>
      </div>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Lesson settings"
        side="right"
      >
        {settingsPanel}
      </Sheet>
    </div>
  );
}

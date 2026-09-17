"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadLessonPreviewSetting, saveLessonPreview } from "@/features/lessons/preview-actions";

export function LessonPreviewSetting({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    let active = true;
    loadLessonPreviewSetting(courseId, lessonId)
      .then((result) => {
        if (!active) return;
        if (result.success) {
          setEnabled(result.enabled);
          setReady(true);
        } else setError(result.error);
        setBusy(false);
      })
      .catch(() => {
        if (active) {
          setError("Could not load preview settings. Reload to retry.");
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [courseId, lessonId]);
  async function toggle(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await saveLessonPreview({ courseId, lessonId, enabled: next });
      if (result.success) {
        setEnabled(next);
        router.refresh();
      } else setError(result.error);
    } catch {
      setError("Could not save preview settings. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-2 rounded-lg border border-slate-200 p-4">
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || !ready}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Allow free preview before enrollment
      </label>
      <p className="text-xs text-slate-600">
        Publishes this lesson’s text and video for visitors without login, in this course only. Both
        course and lesson must be published; private courses are excluded. Downloads, quizzes, and
        progress remain locked.
      </p>
      <p className="text-xs font-medium text-brand-700" role="status">
        {busy ? "Loading / saving…" : enabled ? "Free preview enabled" : "Free preview off"}
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

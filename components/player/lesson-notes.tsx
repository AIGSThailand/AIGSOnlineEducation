"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { lessonNoteAction } from "@/features/notes/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function LessonNotes({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Loading notes…");
  const [failed, setFailed] = useState(false);
  const latest = useRef("");
  const saved = useRef("");
  const queue = useRef(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const mounted = useRef(true);

  const persist = useCallback(
    (value: string, remove = false) => {
      clearTimeout(timer.current);
      setStatus("Saving…");
      setFailed(false);
      queue.current = queue.current.then(async () => {
        try {
          const result = await lessonNoteAction(
            { courseId, lessonId, body: value },
            remove ? "delete" : "save"
          );
          if (result.error) throw new Error(result.error);
          saved.current = value;
          if (mounted.current)
            setStatus(
              latest.current === value ? (remove ? "Note deleted" : "Saved") : "Unsaved changes"
            );
        } catch {
          if (mounted.current) {
            setFailed(true);
            setStatus("Not saved. Retry before leaving this lesson.");
          }
        }
      });
    },
    [courseId, lessonId]
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    lessonNoteAction({ courseId, lessonId }, "read")
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setStatus(result.error);
          return;
        }
        latest.current = saved.current = result.body ?? "";
        setBody(latest.current);
        setReady(true);
        setStatus("Saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("Notes are unavailable. Reload to try again.");
      });
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guardNavigation = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (link && latest.current !== saved.current) {
        event.preventDefault();
        event.stopPropagation();
        persist(latest.current);
        setStatus("Saving your note. Please wait, then open the link again.");
      }
    };
    document.addEventListener("click", guardNavigation, true);
    window.addEventListener("beforeunload", warn);
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer.current);
      if (latest.current !== saved.current) persist(latest.current);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardNavigation, true);
    };
  }, [courseId, lessonId, persist]);

  return (
    <section
      className="rounded-sm border border-[var(--border)] bg-white p-4 sm:p-6"
      aria-labelledby="my-notes-title"
    >
      <h2 id="my-notes-title" className="text-lg font-bold">
        My Notes
      </h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Private to your account. Your notes save automatically.
      </p>
      <label htmlFor="lesson-private-note" className="sr-only">
        Your private lesson notes
      </label>
      <Textarea
        id="lesson-private-note"
        className="mt-4 min-h-[180px]"
        value={body}
        disabled={!ready}
        maxLength={20000}
        placeholder="Write what you want to remember from this lesson…"
        onChange={(event) => {
          const value = event.target.value;
          latest.current = value;
          setBody(value);
          setStatus("Unsaved changes");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => persist(value), 800);
        }}
        onBlur={() => {
          if (ready && latest.current !== saved.current) persist(latest.current);
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-xs text-[var(--text-secondary)]">
          {status} · {body.length.toLocaleString()} / 20,000
        </p>
        <div className="flex gap-2">
          {failed && (
            <Button variant="outline" size="sm" onClick={() => persist(latest.current)}>
              Retry save
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!ready || !body}
            onClick={() => {
              if (!window.confirm("Delete your note for this lesson?")) return;
              latest.current = "";
              setBody("");
              persist("", true);
            }}
          >
            Delete note
          </Button>
        </div>
      </div>
    </section>
  );
}

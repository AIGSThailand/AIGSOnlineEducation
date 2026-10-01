"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  readLessonTools,
  sendLessonQuestion,
  setLessonBookmark,
  type LessonMessage,
} from "@/features/learning-tools/actions";

export function LessonTools({
  courseId,
  lessonId,
  title,
  studentId,
  staff = false,
}: {
  courseId: string;
  lessonId: string;
  title: string;
  studentId?: string;
  staff?: boolean;
}) {
  const [messages, setMessages] = useState<LessonMessage[]>([]);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const messageId = useRef<string>();
  const mounted = useRef(true);
  const load = useCallback(async () => {
    try {
      const result = await readLessonTools({ courseId, lessonId, studentId });
      if (!mounted.current) return;
      if (result.error) {
        setStatus(result.error);
        return;
      }
      setMessages(result.messages || []);
      setSaved(!!result.bookmarked);
      setReady(true);
      setStatus("");
    } catch {
      if (mounted.current) setStatus("Unable to refresh. Please try again.");
    }
  }, [courseId, lessonId, studentId]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);
  const lessonUrl = `/courses/${courseId}/lessons/${lessonId}`;
  return (
    <section className="mt-6 space-y-4 rounded-sm border border-[var(--border)] p-4 sm:p-6">
      {!staff && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={!ready || busy}
            aria-pressed={saved}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await setLessonBookmark({ courseId, lessonId, saved: !saved });
                if (result.error) setStatus(result.error);
                else {
                  setSaved(!saved);
                  setStatus(saved ? "Bookmark removed" : "Lesson saved");
                }
              } catch {
                setStatus("Unable to update bookmark. Try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {saved ? "Remove bookmark" : "Bookmark lesson"}
          </Button>
          <Link href="/student/bookmarks" className="text-sm underline">
            Saved lessons
          </Link>
          <Link
            href={`/student/support?subject=${encodeURIComponent(`Lesson issue: ${title}`.slice(0, 200))}&lesson=${encodeURIComponent(lessonUrl)}`}
            className="text-sm underline"
          >
            Report an issue
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{staff ? title : "Questions"}</h2>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void load()}>
          Refresh replies
        </Button>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        Visible to you, assigned course instructors, and administrators. Other students cannot see
        this conversation.
      </p>
      {ready && !messages.length && (
        <p className="text-sm">No questions yet. Ask about anything in this lesson.</p>
      )}
      <ol className="max-h-96 space-y-3 overflow-y-auto" aria-label="Lesson conversation">
        {messages.map((message) => (
          <li
            key={message.id}
            className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] p-3"
          >
            <p className="text-xs font-bold">
              {message.author_id === message.student_id ? "Student" : "Course team"} ·{" "}
              <time dateTime={message.created_at}>
                {new Date(message.created_at).toLocaleString()}
              </time>
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
          </li>
        ))}
      </ol>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !body.trim()) return;
          setBusy(true);
          messageId.current ||= crypto.randomUUID();
          try {
            const result = await sendLessonQuestion({
              courseId,
              lessonId,
              studentId,
              body,
              messageId: messageId.current,
            });
            if (result.error) setStatus(result.error);
            else {
              setBody("");
              messageId.current = undefined;
              await load();
            }
          } catch {
            setStatus("Message was not sent. Please retry.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor={`question-${studentId || lessonId}`} className="block text-sm font-bold">
          {staff ? "Reply" : "Your question"}
        </label>
        <Textarea
          id={`question-${studentId || lessonId}`}
          required
          maxLength={5000}
          disabled={!ready || busy}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            messageId.current = undefined;
          }}
        />
        <Button type="submit" disabled={!ready || busy || !body.trim()}>
          {busy ? "Saving…" : staff ? "Send reply" : "Send question"}
        </Button>
      </form>
      <p role="status" className="text-sm text-[var(--text-secondary)]">
        {status}
      </p>
    </section>
  );
}

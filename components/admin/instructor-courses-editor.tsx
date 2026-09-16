"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setInstructorCoursesAction } from "@/features/users/actions";
import type { CourseOption } from "@/features/users/types";

export function InstructorCoursesEditor({
  userId,
  assigned,
  allCourses,
}: {
  userId: string;
  assigned: { id: string; title: string }[];
  allCourses: CourseOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set(assigned.map((c) => c.id)));
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [allCourses, query]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await setInstructorCoursesAction({
        userId,
        courseIds: Array.from(selectedIds),
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage("Course assignments saved.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-slate-600">
        {assigned.length === 0
          ? "No courses assigned"
          : assigned.length <= 2
            ? assigned.map((c) => c.title).join(", ")
            : `${assigned.length} courses`}
      </p>
      <button
        type="button"
        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Assign courses"}
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input
            className="h-9 w-full rounded-md border border-slate-300 px-2 text-xs"
            placeholder="Filter courses…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
            {filtered.map((course) => (
              <li key={course.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-white">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedIds.has(course.id)}
                    onChange={() => toggle(course.id)}
                  />
                  <span>
                    {course.title}
                    <span className="ml-1 text-slate-400">{course.status}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" onClick={onSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save assignments"}
          </Button>
          {message ? <p className="text-xs text-slate-600">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

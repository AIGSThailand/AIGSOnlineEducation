"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setGroupCoursesAction } from "@/features/groups/actions";
import type { GroupCourseOption } from "@/features/groups/types";

export function GroupCoursesEditor({
  groupId,
  selected,
  allCourses,
}: {
  groupId: string;
  selected: GroupCourseOption[];
  allCourses: GroupCourseOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState(() => new Set(selected.map((c) => c.id)));
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
      const result = await setGroupCoursesAction({
        groupId,
        courseIds: Array.from(selectedIds),
      });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage("Courses updated. Existing members were enrolled where needed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Courses in this bundle</h3>
          <p className="text-xs text-slate-500">{selectedIds.size} selected</p>
        </div>
        <Button type="button" onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save courses"}
        </Button>
      </div>
      <input
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        placeholder="Filter courses…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-slate-100 p-2">
        {filtered.map((course) => (
          <li key={course.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.has(course.id)}
                onChange={() => toggle(course.id)}
              />
              <span>
                <span className="font-medium text-slate-900">{course.title}</span>
                <span className="ml-2 text-xs text-slate-500">{course.status}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}

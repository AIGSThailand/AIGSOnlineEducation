import Link from "next/link";
import { requireAuth } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
export default async function BookmarksPage() {
  const user = await requireAuth();
  const db = await createClient();
  const { data, error } = await db
    .from("lesson_bookmarks")
    .select("course_id, lesson_id")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .returns<{ course_id: string; lesson_id: string }[]>();
  const ids = Array.from(new Set((data || []).map((row) => row.lesson_id)));
  const { data: lessons } = ids.length
    ? await db
        .from("lessons")
        .select("id,title")
        .in("id", ids)
        .returns<{ id: string; title: string }[]>()
    : { data: [] };
  const titles = new Map((lessons || []).map((lesson) => [lesson.id, lesson.title]));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Saved lessons</h1>
      <p className="text-sm">Return to lessons you bookmarked. Course access is still required.</p>
      {error ? (
        <p role="alert">Saved lessons are unavailable. Please try again later.</p>
      ) : !data?.length ? (
        <p>No bookmarks yet. Bookmark a lesson while learning.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((row) => (
            <li key={`${row.course_id}:${row.lesson_id}`}>
              <Link
                className="block rounded-sm border border-[var(--border)] bg-white p-4 font-bold hover:underline"
                href={`/courses/${row.course_id}/lessons/${row.lesson_id}`}
              >
                {titles.get(row.lesson_id) || "Saved lesson"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

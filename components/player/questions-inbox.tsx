import { requireRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { LessonTools } from "./lesson-tools";
export async function QuestionsInbox() {
  await requireRole(["admin", "instructor"]);
  const db = await createClient();
  // RLS limits instructors to conversations in their assigned courses.
  const { data, error } = await db
    .from("lesson_questions")
    .select("course_id,lesson_id,student_id,created_at")
    .order("created_at", { ascending: false })
    .returns<{ course_id: string; lesson_id: string; student_id: string; created_at: string }[]>();
  const threads = Array.from(
    new Map(
      (data || []).map((row) => [`${row.course_id}:${row.lesson_id}:${row.student_id}`, row])
    ).values()
  );
  const ids = Array.from(new Set(threads.map((row) => row.lesson_id)));
  const { data: lessons } = ids.length
    ? await db
        .from("lessons")
        .select("id,title")
        .in("id", ids)
        .returns<{ id: string; title: string }[]>()
    : { data: [] };
  const titles = new Map((lessons || []).map((row) => [row.id, row.title]));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Lesson questions</h1>
      <p className="text-sm">Private conversations with students in your courses.</p>
      {error ? (
        <p role="alert">Questions are unavailable. Please try again later.</p>
      ) : !threads.length ? (
        <p>No questions yet.</p>
      ) : (
        threads.map((row, index) => (
          <details
            key={`${row.course_id}:${row.lesson_id}:${row.student_id}`}
            className="rounded-sm border border-[var(--border)] bg-white p-4"
          >
            <summary className="cursor-pointer font-bold">
              {titles.get(row.lesson_id) || "Lesson"} · Conversation {index + 1}
            </summary>
            <LessonTools
              staff
              courseId={row.course_id}
              lessonId={row.lesson_id}
              studentId={row.student_id}
              title={titles.get(row.lesson_id) || "Lesson question"}
            />
          </details>
        ))
      )}
    </div>
  );
}

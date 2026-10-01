"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canAccessCourse, getCurrentUser } from "@/lib/auth/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent } from "@/features/player/build-player";

const schema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  body: z.string().max(20000).optional(),
});

export async function lessonNoteAction(input: unknown, operation: "read" | "save" | "delete") {
  const parsed = schema.safeParse(input);
  if (!parsed.success || !["read", "save", "delete"].includes(operation))
    return { error: "Invalid note." };
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to use your notes." };
  const { courseId, lessonId, body } = parsed.data;
  if (!(await canAccessCourse(courseId))) return { error: "Course access is required." };
  const player = await getCoursePlayerData(courseId, user.id);
  if (!player || !findStepByContent(player.flatSteps, "lesson", lessonId))
    return { error: "Lesson not found in this course." };
  const db = await createClient();
  const key = { student_id: user.id, course_id: courseId, lesson_id: lessonId };
  if (operation === "read") {
    const { data, error } = await db
      .from("lesson_notes")
      .select("body")
      .match(key)
      .maybeSingle<{ body: string }>();
    return error
      ? { error: "Notes are unavailable. Please try again later." }
      : { body: data?.body ?? "" };
  }
  if (operation === "save" && body === undefined) return { error: "Note text is required." };
  const { error } =
    operation === "delete"
      ? await db.from("lesson_notes").delete().match(key)
      : await db
          .from("lesson_notes")
          .upsert({ ...key, body: body!, updated_at: new Date().toISOString() } as never);
  return error
    ? { error: "Your note could not be saved. Please retry before leaving." }
    : { success: true };
}

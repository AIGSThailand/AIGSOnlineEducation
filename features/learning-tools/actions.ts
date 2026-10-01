"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, canAccessCourse } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCoursePlayerData } from "@/features/player/queries";
import { findStepByContent, lockedStepKeys } from "@/features/player/build-player";

const contextSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
});
export type LessonMessage = {
  id: string;
  student_id: string;
  author_id: string;
  body: string;
  created_at: string;
};
async function authorize(input: unknown) {
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid lesson.");
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to use lesson tools.");
  const { courseId, lessonId } = parsed.data;
  const staff = await canManageCourse(courseId);
  if (!staff && !(await canAccessCourse(courseId))) throw new Error("Course access is required.");
  const studentId = parsed.data.studentId || user.id;
  if (studentId !== user.id && !staff) throw new Error("This conversation is private.");
  const player = await getCoursePlayerData(courseId, user.id);
  const step = player && findStepByContent(player.flatSteps, "lesson", lessonId);
  if (!player || !step) throw new Error("Lesson not found.");
  if (
    lockedStepKeys(
      player.flatSteps,
      new Set(player.completedKeys),
      player.progressionType === "linear",
      staff
    ).has(step.key)
  )
    throw new Error("Complete previous lessons first.");
  return { user, studentId, courseId, lessonId };
}
export async function readLessonTools(
  input: unknown
): Promise<{ messages?: LessonMessage[]; bookmarked?: boolean; error?: string }> {
  try {
    const { user, studentId, courseId, lessonId } = await authorize(input);
    const db = await createClient();
    const [messages, bookmark] = await Promise.all([
      db
        .from("lesson_questions")
        .select("id, student_id, author_id, body, created_at")
        .match({ student_id: studentId, course_id: courseId, lesson_id: lessonId })
        .order("created_at", { ascending: true })
        .returns<LessonMessage[]>(),
      db
        .from("lesson_bookmarks")
        .select("lesson_id")
        .match({ student_id: user.id, course_id: courseId, lesson_id: lessonId })
        .maybeSingle<{ lesson_id: string }>(),
    ]);
    if (messages.error || bookmark.error)
      return { error: "Lesson tools are unavailable. Please try again later." };
    return { messages: messages.data || [], bookmarked: !!bookmark.data };
  } catch {
    return {
      error: "Unable to load this private conversation. Check your course access and try again.",
    };
  }
}
export async function sendLessonQuestion(input: unknown) {
  const parsed = contextSchema
    .extend({ body: z.string().trim().min(1).max(5000), messageId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { error: "Enter a message of 1–5,000 characters." };
  try {
    const { user, studentId, courseId, lessonId } = await authorize(parsed.data);
    const db = await createClient();
    const { error } = await db
      .from("lesson_questions")
      .insert({
        id: parsed.data.messageId,
        student_id: studentId,
        course_id: courseId,
        lesson_id: lessonId,
        author_id: user.id,
        body: parsed.data.body,
      } as never);
    // Retrying the same message after a lost response must not create a duplicate.
    if (error && error.code !== "23505") return { error: "Message was not sent. Please retry." };
    return { success: true };
  } catch {
    return { error: "Unable to send. Check your course access and try again." };
  }
}
export async function setLessonBookmark(input: unknown) {
  const parsed = contextSchema.extend({ saved: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid bookmark." };
  try {
    const { user, courseId, lessonId } = await authorize(parsed.data);
    const db = await createClient();
    const key = { student_id: user.id, course_id: courseId, lesson_id: lessonId };
    const { error } = parsed.data.saved
      ? await db.from("lesson_bookmarks").insert(key as never)
      : await db.from("lesson_bookmarks").delete().match(key);
    if (error && !(parsed.data.saved && error.code === "23505"))
      return { error: "Bookmark could not be updated." };
    return { success: true };
  } catch {
    return { error: "Unable to update bookmark. Check your course access." };
  }
}

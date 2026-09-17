import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const previewSchema = z.object({
  media_course_id: z.string().uuid(),
  id: z.string().uuid(),
  title: z.string(),
  content: z.string().nullable(),
  video_url: z.string().nullable(),
  video_captions_url: z.string().nullable(),
});
export type PublicLessonPreview = z.infer<typeof previewSchema>;

export async function getPublicLessonPreview(courseId: string, lessonId: string) {
  if (
    !z.string().uuid().safeParse(courseId).success ||
    !z.string().uuid().safeParse(lessonId).success
  )
    return null;
  const db = await createClient();
  const { data, error } = await db.rpc(
    "get_public_lesson_preview" as never,
    { p_course_id: courseId, p_lesson_id: lessonId } as never
  );
  if (error) throw new Error(error.message);
  return data ? previewSchema.parse(data) : null;
}

export async function getPublicPreviewIds(courseId: string, client?: Awaited<ReturnType<typeof createClient>>): Promise<string[]> {
  const db = client ?? await createClient();
  const { data, error } = await db.rpc(
    "public_preview_lesson_ids" as never,
    { p_course_id: courseId } as never
  );
  if (error) throw new Error(error.message);
  return z.array(z.string().uuid()).parse(data || []);
}

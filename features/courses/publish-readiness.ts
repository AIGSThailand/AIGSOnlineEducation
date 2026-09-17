import { createClient } from "@/lib/supabase/server";
import { getCourseBuilderData } from "./queries";
import { evaluatePublishReadiness, type PublishLesson, type PublishQuiz, type PublishSnapshot, type PublishReport } from "./publish-checks";

export async function loadPublishReadiness(courseId: string): Promise<PublishReport> {
  const db = await createClient();
  const builder = await getCourseBuilderData(courseId);
  if (!builder) throw new Error("Course not found.");
  const { data: course, error } = await db.from("courses")
    .select("title, slug, description, thumbnail_url, access_type, stripe_price_id")
    .eq("id", courseId).single<PublishSnapshot["course"]>();
  if (error || !course) throw new Error("Could not check course settings.");
  const { data: steps, error: stepsError } = await db.from("course_steps")
    .select("lesson_id, quiz_id, section_id").eq("course_id", courseId)
    .returns<{ lesson_id: string | null; quiz_id: string | null; section_id: string | null }[]>();
  if (stepsError) throw new Error("Could not check curriculum placements.");
  const lessonIds = Array.from(new Set([
    ...builder.sections.flatMap((section) => section.items.filter((item) => item.kind === "lesson").map((item) => item.id)),
    ...(steps || []).flatMap((step) => step.lesson_id ? [step.lesson_id] : []),
  ]));
  const quizIds = Array.from(new Set((steps || []).flatMap((step) => step.quiz_id ? [step.quiz_id] : [])));
  const [lessonResult, quizResult] = await Promise.all([
    lessonIds.length ? db.from("lessons").select("id, title, status, content, video_url, video_provider").in("id", lessonIds).returns<PublishLesson[]>() : Promise.resolve({ data: [], error: null }),
    quizIds.length ? db.from("quizzes").select("id, title, status, quiz_questions(questions(question_text, question_type, question_options(is_correct, answer_text)))").in("id", quizIds).returns<PublishQuiz[]>() : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessonResult.error || quizResult.error || lessonResult.data?.length !== lessonIds.length || quizResult.data?.length !== quizIds.length) throw new Error("Some curriculum items could not be checked. Verify access and retry.");
  const sectionFor = (id: string) => builder.sections.find((section) => section.items.some((item) => item.id === id))?.id;
  return evaluatePublishReadiness({ course, sectionCount: builder.sections.length,
    lessons: (lessonResult.data || []).map((lesson) => ({ ...lesson, sectionId: sectionFor(lesson.id) })),
    quizzes: (quizResult.data || []).map((quiz) => ({ ...quiz, sectionId: sectionFor(quiz.id) })),
  });
}

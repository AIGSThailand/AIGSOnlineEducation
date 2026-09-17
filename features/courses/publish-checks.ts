import { mediaUrlSchema } from "@/lib/validations/media-url";

export type PublishIssue = {
  severity: "error" | "warning";
  message: string;
  target: { type: "course" | "lesson" | "quiz"; id?: string; sectionId?: string };
};
export type PublishReport = { valid: boolean; errors: string[]; issues: PublishIssue[] };
export type PublishLesson = { id: string; title: string; status: string; content: string | null; video_url: string | null; video_provider: string | null; sectionId?: string };
export type PublishQuestion = { question_text: string; question_type: string; question_options: { is_correct: boolean; answer_text: string }[] };
export type PublishQuiz = { id: string; title: string; status: string; sectionId?: string; quiz_questions: { questions: PublishQuestion | null }[] };
export type PublishSnapshot = {
  course: { title: string; slug: string; description: string | null; thumbnail_url: string | null; access_type: string; stripe_price_id: string | null };
  sectionCount: number; lessons: PublishLesson[]; quizzes: PublishQuiz[];
};

export function evaluatePublishReadiness(snapshot: PublishSnapshot): PublishReport {
  const issues: PublishIssue[] = [];
  const courseTarget = { type: "course" as const };
  const add = (severity: PublishIssue["severity"], message: string, target: PublishIssue["target"] = courseTarget) => issues.push({ severity, message, target });
  const { course } = snapshot;
  if (!course.title.trim()) add("error", "Add a course title.");
  if (!course.slug.trim()) add("error", "Add a course slug.");
  if (!snapshot.sectionCount) add("error", "Add a curriculum section.");
  if (!snapshot.lessons.length) add("error", "Add at least one lesson to the curriculum.");
  if (course.access_type === "paid" && !course.stripe_price_id) add("error", "Configure a Stripe price for this paid course in Commerce settings.");
  if (!course.description?.trim()) add("warning", "Add a course description so visitors know what they will learn.");
  if (!course.thumbnail_url) add("warning", "Add a course thumbnail.");
  else if (!mediaUrlSchema.safeParse(course.thumbnail_url).success) add("error", "Correct the course thumbnail URL.");
  for (const lesson of snapshot.lessons) {
    const target = { type: "lesson" as const, id: lesson.id, sectionId: lesson.sectionId };
    const label = lesson.title || "Untitled lesson";
    if (lesson.status !== "published") add("error", `${label}: publish or remove this ${lesson.status} lesson before publishing the course.`, target);
    const text = (lesson.content || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "").replace(/&(?:nbsp|#160);/g, " ").trim();
    if (!text && !/<(?:img|video|iframe)\b/i.test(lesson.content || "") && !lesson.video_url?.trim()) add("error", `${label}: add lesson text or media.`, target);
    if (lesson.video_provider && !lesson.video_url?.trim()) add("error", `${label}: a video provider is selected but its playback URL is missing.`, target);
    if (lesson.video_url && !mediaUrlSchema.safeParse(lesson.video_url).success) add("error", `${label}: correct the video URL.`, target);
    for (const match of Array.from((lesson.content || "").matchAll(/<(?:img|video|iframe|source)\b[^>]*\ssrc\s*=\s*["']([^"']*)["']/gi))) {
      if (!match[1] || !mediaUrlSchema.safeParse(match[1].replace(/&amp;/g, "&")).success) {
        add("error", `${label}: an embedded media URL is empty or invalid.`, target); break;
      }
    }
  }
  for (const quiz of snapshot.quizzes) {
    const target = { type: "quiz" as const, id: quiz.id, sectionId: quiz.sectionId };
    if (quiz.status !== "published") add("error", `${quiz.title}: publish or remove this ${quiz.status} quiz.`, target);
    if (!quiz.quiz_questions.length) add("error", `${quiz.title}: add at least one question.`, target);
    quiz.quiz_questions.forEach(({ questions: question }, index) => {
      const label = `${quiz.title}, question ${index + 1}`;
      if (!question?.question_text.trim()) add("error", `${label}: question text is missing.`, target);
      if (question && ["single_choice", "multiple_choice", "true_false"].includes(question.question_type)) {
        const choices = question.question_options;
        const correct = choices.filter((choice) => choice.is_correct).length;
        if (choices.length < 2 || choices.some((choice) => !choice.answer_text.trim()) || correct === 0 || (question.question_type !== "multiple_choice" && correct !== 1)) {
          add("error", `${label}: provide answer choices and a valid correct answer.`, target);
        }
      } else if (question) add("warning", `${label}: verify the manual grading workflow for ${question.question_type}.`, target);
    });
  }
  return { valid: !issues.some((issue) => issue.severity === "error"), errors: issues.filter((issue) => issue.severity === "error").map((issue) => issue.message), issues };
}

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getCoursePlayerData } from "@/features/player/queries";
import { getLearningResume } from "@/features/player/resume";

export async function ResumeLearning({
  courseId,
  studentId,
}: {
  courseId: string;
  studentId: string;
}) {
  const player = await getCoursePlayerData(courseId, studentId);
  if (!player) return null;
  const resume = getLearningResume(player);
  return (
    <section
      aria-labelledby="resume-title"
      className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm"
    >
      <div className="grid md:grid-cols-[1fr_16rem]">
        <div className="p-6 sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-700">
            {resume.finished
              ? "Keep exploring"
              : resume.completed
                ? "Pick up where you left off"
                : "Ready when you are"}
          </p>
          <h2 id="resume-title" className="text-2xl font-semibold text-slate-900">
            {player.courseTitle}
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            {resume.next
              ? `${resume.finished ? "Review" : "Up next"}: ${resume.next.title}`
              : "Open the course overview to explore your curriculum."}
          </p>
          <Link
            href={resume.next?.href || `/courses/${courseId}`}
            className="mt-6 inline-flex min-h-11 items-center gap-3 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {resume.finished
              ? "Review course"
              : resume.completed
                ? "Continue learning"
                : "Start learning"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-col justify-center border-t border-brand-100 bg-brand-50 p-6 sm:p-8 md:border-l md:border-t-0">
          <BookOpen className="mb-4 h-7 w-7 text-brand-600" strokeWidth={1.5} />
          <p className="text-3xl font-semibold text-brand-900">
            {resume.percent}% <span className="text-sm font-normal">complete</span>
          </p>
          <progress
            aria-label="Course completion"
            value={resume.percent}
            max={100}
            className="mt-3 h-2 w-full accent-brand-600"
          />
          <p className="mt-3 text-xs text-slate-600">
            {resume.completed} of {resume.total} learning steps completed
          </p>
        </div>
      </div>
    </section>
  );
}

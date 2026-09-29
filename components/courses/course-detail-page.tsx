import { CourseContentsNav } from "@/components/courses/course-contents-nav";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAnonymousClient } from "@/lib/supabase/anonymous";
import { canAccessCourse, getCurrentUser } from "@/lib/auth/permissions";
import { canManageCourse } from "@/features/courses/permissions";
import { getCourseSyllabus } from "@/features/courses/queries";
import { getPublicPreviewIds } from "@/features/lessons/preview";
import { fulfillCheckoutSessionForUser } from "@/lib/stripe/enroll-from-checkout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BuyCourseButton } from "@/components/stripe/buy-course-button";
import { RichContent } from "@/components/courses/rich-content";
import { BookOpen, CheckCircle, Clock, PlayCircle, Lock, ChevronDown } from "lucide-react";
import type { Database } from "@/types/database.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

interface CourseDetailPageProps {
  audience?: "visitor";
  params: {
    courseId: string;
  };
  searchParams?: {
    preview?: string;
    checkout?: string;
    session_id?: string;
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
  audience,
}: CourseDetailPageProps) {
  const { courseId } = params;
  const visitorReview = audience === "visitor";
  const supabase = visitorReview ? createAnonymousClient() : await createClient();
  const user = visitorReview ? null : await getCurrentUser();

  let checkoutMessage: { tone: "success" | "error"; text: string } | null = null;
  if (user && searchParams?.session_id) {
    const fulfilled = await fulfillCheckoutSessionForUser(searchParams.session_id, user.id);
    if (fulfilled.ok) {
      checkoutMessage = {
        tone: "success",
        text:
          fulfilled.kind === "group"
            ? `Payment confirmed — you are enrolled in ${fulfilled.enrolled} course(s) from this bundle.`
            : "Payment confirmed — you are enrolled in this course.",
      };
    } else if (searchParams.checkout === "success") {
      checkoutMessage = {
        tone: "error",
        text: `Payment received, but enrollment could not be confirmed yet (${fulfilled.error}). Refresh this page or contact support if access stays locked.`,
      };
      console.error("[Course checkout fulfill]", fulfilled.error);
    }
  }

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();

  if (!course && visitorReview)
    return (
      <p className="mx-auto max-w-3xl p-8">
        Visitor review: this course is not available to anonymous visitors. Publish it before
        reviewing the public page.
      </p>
    );
  if (!course) {
    notFound();
  }

  const syllabus = await getCourseSyllabus(courseId, supabase);
  const previewLessonIds = new Set(await getPublicPreviewIds(courseId, supabase));
  const { modules, lessonCount, firstLessonId } = syllabus;

  let isEnrolled = false;
  if (user) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("status, expires_at")
      .eq("course_id", courseId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .maybeSingle<{ status: string; expires_at: string | null }>();

    isEnrolled = !!(
      enrollment &&
      (!enrollment.expires_at || new Date(enrollment.expires_at).getTime() > Date.now())
    );
  }

  const canManage = !visitorReview && (await canManageCourse(courseId));
  const isPreview = searchParams?.preview === "1" && canManage;
  // Admins / assigned instructors / group members unlock via canAccessCourse —
  // enrollment is only required for regular students.
  const hasContentAccess =
    !visitorReview && (isEnrolled || (await canAccessCourse(courseId)) || isPreview);
  const role = user?.profile?.role;
  const accessAsStaff = hasContentAccess && !isEnrolled && (role === "admin" || canManage);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      {visitorReview && (
        <p role="status" className="mb-6 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          Visitor content review — course and curriculum data use anonymous permissions. Your staff
          account remains signed in. Also use a private browser window to verify media permissions
          and sign-in behavior end to end.
        </p>
      )}
      <nav aria-label="Breadcrumb" className="mb-8 text-sm">
        <Link href="/courses" className="text-slate-500 hover:text-brand-700">
          ← All courses
        </Link>
      </nav>
      {checkoutMessage ? (
        <div
          className={
            checkoutMessage.tone === "success"
              ? "mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          }
          role="status"
        >
          {checkoutMessage.text}
        </div>
      ) : null}
      {isPreview && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          Preview mode — you are viewing this course as an authorized builder. Draft content is
          visible only to you.
        </div>
      )}
      <section className="border-l-4 border-brand-800 bg-brand-600 p-6 text-white sm:p-10">
        <div className="mb-3 flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            AIGS · Online learning
          </span>
          {course.status !== "published" && <Badge>{course.status}</Badge>}
          {isEnrolled && <Badge variant="default">Active Enrollment</Badge>}
          {accessAsStaff && <Badge variant="warning">Staff access</Badge>}
        </div>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
          {course.title}
        </h1>
        {course.excerpt && (
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/90">{course.excerpt}</p>
        )}
        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/25 pt-5 text-sm text-white/90">
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {modules.length} sections · {lessonCount} lessons
          </span>
          {previewLessonIds.size > 0 && (
            <a
              href="#curriculum"
              className="flex items-center gap-2 font-bold text-white underline underline-offset-4"
            >
              <PlayCircle className="h-4 w-4" />
              Free lesson previews
            </a>
          )}
          {course.access_expiration_enabled && course.access_period_days && (
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {course.access_period_days} days of course access
            </span>
          )}
        </div>
      </section>
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        <CourseContentsNav modules={modules.map(({ id, title }) => ({ id, title }))} />
        <div className="order-3 min-w-0 space-y-8 lg:order-none">
          <section
            id="overview"
            className="scroll-mt-24 rounded-sm border border-[var(--border)] bg-white p-5 sm:p-7"
          >
            <h2 className="text-2xl font-semibold text-slate-900">About this course</h2>
            <RichContent
              html={course.description}
              className="mt-4 text-base"
              fallback="No description provided."
            />
          </section>

          <section id="curriculum" className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900">Explore the curriculum</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              See what’s inside. Select a section to browse its lessons.
            </p>
            {modules.length > 0 ? (
              <div className="space-y-3">
                {modules.map((module, mIdx) => (
                  <details
                    key={module.id}
                    id={`module-${module.id}`}
                    open={mIdx === 0}
                    className="group rounded-xl border border-[var(--border)] bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                      <span>
                        <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                          Section {mIdx + 1} · {module.lessons.length}{" "}
                          {module.lessons.length === 1 ? "lesson" : "lessons"}
                        </span>
                        <span className="font-semibold text-slate-900">{module.title}</span>
                      </span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-brand-700 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 px-5 pb-3">
                      {module.lessons.length === 0 ? (
                        <p className="text-xs text-slate-400">No lessons in this section yet.</p>
                      ) : (
                        module.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 text-sm text-slate-700"
                          >
                            <div className="flex items-center space-x-2">
                              <BookOpen className="h-4 w-4 shrink-0 text-slate-400" />
                              <span>{lesson.title}</span>
                            </div>
                            {hasContentAccess || previewLessonIds.has(lesson.id) ? (
                              <Link
                                href={`/courses/${courseId}/lessons/${lesson.id}${visitorReview ? "?audience=visitor" : ""}`}
                                className="shrink-0 rounded-full bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                              >
                                {hasContentAccess ? "Start →" : "Free preview →"}
                              </Link>
                            ) : (
                              <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Curriculum modules are being scheduled.</p>
            )}
          </section>
        </div>

        <aside
          id="enrollment"
          className="order-2 scroll-mt-28 lg:order-none lg:col-start-2 xl:sticky xl:top-28 xl:col-start-auto"
        >
          <Card className="rounded-sm border-[var(--border)] bg-white p-5 shadow-sm sm:p-6">
            {course.thumbnail_url && (
              <div className="mb-4 aspect-video max-h-64 overflow-hidden rounded-md bg-slate-100 lg:max-h-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {hasContentAccess ? "Your course" : "Start your learning journey"}
              </h2>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <BookOpen className="mr-2 h-4 w-4 text-slate-400" /> Modules
                  </span>
                  <span className="font-semibold text-slate-900">{modules.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-slate-400" /> Total Lessons
                  </span>
                  <span className="font-semibold text-slate-900">{lessonCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <CheckCircle className="mr-2 h-4 w-4 text-slate-400" /> Access
                  </span>
                  <span className="font-semibold text-slate-900">
                    {hasContentAccess ? (isEnrolled ? "Enrolled" : "Staff") : "Locked"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                {hasContentAccess && firstLessonId ? (
                  <Link href={`/courses/${courseId}/lessons/${firstLessonId}`} className="block">
                    <Button className="w-full" size="lg">
                      {isEnrolled ? "Go to First Lesson" : "Open as staff"}
                    </Button>
                  </Link>
                ) : hasContentAccess && canManage ? (
                  <Link href={`/admin/courses/${courseId}/edit`} className="block">
                    <Button className="w-full" size="lg" variant="outline">
                      Open course builder
                    </Button>
                  </Link>
                ) : user ? (
                  course.stripe_price_id ? (
                    <BuyCourseButton
                      courseId={course.id}
                      courseTitle={course.title}
                      priceId={course.stripe_price_id}
                      label="Enroll Now"
                    />
                  ) : (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      Enrollment is not open for this course yet. Please check back soon.
                    </p>
                  )
                ) : (
                  <Link href={`/login?redirect=/courses/${courseId}`} className="block">
                    <Button className="w-full" size="lg">
                      Sign In to Enroll
                    </Button>
                  </Link>
                )}
              </div>
              {!hasContentAccess && previewLessonIds.size > 0 && (
                <a
                  href="#curriculum"
                  className="block rounded-lg border border-brand-200 px-4 py-3 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Try a free lesson first
                </a>
              )}
              <p className="text-xs leading-relaxed text-slate-500">
                Review the course description for assessment requirements and access conditions.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

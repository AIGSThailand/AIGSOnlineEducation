import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/permissions";
import { fulfillCheckoutSessionForUser } from "@/lib/stripe/enroll-from-checkout";
import { listActiveAnnouncements } from "@/features/announcements/queries";
import { countMyEarnedCertificates } from "@/features/certificates/queries";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardTitle } from "@/components/ui/card";
import { ResumeLearning } from "@/components/dashboard/resume-learning";
import { CourseCard } from "@/components/courses/course-card";
import { BookOpen, CheckCircle, Award } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CourseWithInstructors } from "@/types/lms.types";

interface StudentDashboardPageProps {
  searchParams?: {
    session_id?: string;
    success?: string;
    checkout?: string;
  };
}

export default async function StudentDashboardPage({ searchParams }: StudentDashboardPageProps) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  if (user && searchParams?.session_id) {
    const fulfilled = await fulfillCheckoutSessionForUser(searchParams.session_id, user.id);
    if (!fulfilled.ok) {
      console.error("[Student dashboard checkout fulfill]", fulfilled.error);
    }
  }

  // Fetch active enrollments with course details
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrolled_at,
      expires_at,
      course:courses(
        id,
        title,
        slug,
        description,
        status,
        thumbnail_url,
        wordpress_course_id,
        created_at,
        updated_at
      )
    `
    )
    .eq("student_id", user?.id || "")
    .eq("status", "active");

  const now = Date.now();
  type EnrollmentRow = {
    id: string;
    status: string;
    enrolled_at: string;
    expires_at: string | null;
    course: CourseWithInstructors | CourseWithInstructors[] | null;
  };
  const rawList = (enrollments as unknown as EnrollmentRow[] | null) || [];
  const activeEnrollments = rawList.filter(
    (e) => !e.expires_at || new Date(e.expires_at).getTime() > now
  );

  const { count: completedLessonsCount } = await supabase
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("student_id", user?.id || "")
    .eq("completed", true);

  const activeCourses: CourseWithInstructors[] = activeEnrollments
    .map((e) => (Array.isArray(e.course) ? e.course[0] : e.course))
    .filter((c): c is CourseWithInstructors => !!c);

  const announcements = await listActiveAnnouncements(5);
  const certificateCount = user?.id ? await countMyEarnedCertificates(user.id) : 0;
  const { data: recent } =
    activeCourses.length && user
      ? await supabase
          .from("step_progress")
          .select("course_id")
          .eq("student_id", user.id)
          .in(
            "course_id",
            activeCourses.map((course) => course.id)
          )
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ course_id: string }>()
      : { data: null };
  const resumeCourseId = recent?.course_id || activeCourses[0]?.id;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-700">
            Your AIGS learning space
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My Learning</h1>
          <p className="mt-2 text-sm text-slate-500">
            Take the next step in your gemology journey.
          </p>
        </div>
        <Link href="/courses">
          <Button variant="outline">Browse Catalog</Button>
        </Link>
      </div>

      {resumeCourseId && user && <ResumeLearning courseId={resumeCourseId} studentId={user.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Enrolled Courses"
          value={activeCourses.length}
          description="Active learning paths"
          icon={BookOpen}
        />
        <StatCard
          title="Completed Lessons"
          value={completedLessonsCount ?? 0}
          description="Lessons finished"
          icon={CheckCircle}
        />
        <StatCard
          title="Certificates"
          value={certificateCount}
          description="Earned credentials"
          icon={Award}
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Your courses</h2>
          <Link
            href="/student/courses"
            className="text-sm font-semibold text-brand-600 hover:text-brand-500"
          >
            View all courses →
          </Link>
        </div>

        {activeCourses.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeCourses.map((course) => (
              <CourseCard key={course.id} course={course} isEnrolled />
            ))}
          </div>
        ) : (
          <Card className="py-10 text-center">
            <CardTitle className="mb-2">No active course enrollments</CardTitle>
            <p className="mb-6 text-sm text-slate-500">
              Browse our catalog of professional courses to begin learning today.
            </p>
            <Link href="/courses">
              <Button>Browse All Courses</Button>
            </Link>
          </Card>
        )}
      </div>
      <AnnouncementsFeed
        items={announcements}
        listHref="/student/announcements"
        detailBaseHref="/student/announcements"
      />
    </div>
  );
}

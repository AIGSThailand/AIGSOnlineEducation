import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicLinkButton } from "@/components/public/public-button";
import { SectionHeader } from "@/components/public/section-header";
import { PublicCourseCard, PublicCourseGrid } from "@/components/public/course-card";
import type { Database } from "@/types/database.types";
import { ArrowRight } from "lucide-react";

type Course = Pick<
  Database["public"]["Tables"]["courses"]["Row"],
  "id" | "title" | "description" | "excerpt" | "thumbnail_url" | "access_type" | "created_at"
>;

export default async function HomePage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? getRoleDashboardPath(user.profile?.role) : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, excerpt, thumbnail_url, access_type, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);
  const courses = (data || []) as Course[];

  let enrolledCourseIds: string[] = [];
  if (user) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("course_id, expires_at")
      .eq("student_id", user.id)
      .eq("status", "active");
    enrolledCourseIds = ((enrollments || []) as { course_id: string; expires_at: string | null }[])
      .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > Date.now())
      .map((e) => e.course_id);
  }

  return (
    <PublicLayout dashboardHref={dashboardHref}>
      {/* Hero shell — Phase 1 structure; richer imagery/sections in Phase 2 */}
      <section className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--surface-muted)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 20% 20%, var(--brand-primary) 0%, transparent 55%), radial-gradient(ellipse at 80% 0%, var(--accent-gold) 0%, transparent 45%)",
          }}
          aria-hidden
        />
        <div className="public-container relative grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-24">
          <div>
            <p className="public-eyebrow">AIGS Online Education</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.12] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
              Learn gemology from industry experts
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
              Professional online courses in gemstone identification, grading, pricing, and
              gemological practice — built on more than 40 years of AIGS expertise.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PublicLinkButton href="/courses">
                Explore courses <ArrowRight className="h-4 w-4" aria-hidden />
              </PublicLinkButton>
              <PublicLinkButton href="/#about-aigs" variant="secondary">
                About AIGS
              </PublicLinkButton>
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--brand-dark)] p-8 text-white sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">
              Why AIGS
            </p>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-white/85 sm:text-base">
              <li>40+ years of gemological authority</li>
              <li>Structured professional curricula</li>
              <li>Certificates for eligible programs</li>
              <li>Learn online at your own pace</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="course-highlights" className="public-container public-section scroll-mt-24">
        <SectionHeader
          eyebrow="Featured courses"
          title="Start with a subject that interests you"
          description="Browse published AIGS courses. Explore the curriculum before you enroll."
          action={
            <PublicLinkButton href="/courses" variant="tertiary">
              View all courses <ArrowRight className="h-4 w-4" aria-hidden />
            </PublicLinkButton>
          }
        />
        {error ? (
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-8"
            role="status"
          >
            <h3 className="text-lg font-semibold">Course highlights are temporarily unavailable</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Please try the course catalog again shortly.
            </p>
            <PublicLinkButton href="/courses" className="mt-5">
              Open course catalog
            </PublicLinkButton>
          </div>
        ) : (
          <PublicCourseGrid>
            {courses.map((course) => (
              <PublicCourseCard
                key={course.id}
                course={course}
                enrolled={enrolledCourseIds.includes(course.id)}
              />
            ))}
          </PublicCourseGrid>
        )}
        {!error && courses.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">
            New learning opportunities are on the way. Please check back soon.
          </p>
        ) : null}
      </section>

      {/* Placeholder shells for Phase 2 sections */}
      <section
        id="about-aigs"
        className="border-y border-[var(--border)] bg-[var(--surface-muted)]"
      >
        <div className="public-container public-section max-w-4xl">
          <SectionHeader
            eyebrow="About AIGS"
            title="Gemological excellence for professional learners"
            description="The Asian Institute of Gemological Sciences brings classroom authority online — identification, grading, and jewelry knowledge for an international audience."
            headingLevel="h2"
          />
          <PublicLinkButton href="/courses" variant="secondary">
            Browse courses
          </PublicLinkButton>
        </div>
      </section>
    </PublicLayout>
  );
}

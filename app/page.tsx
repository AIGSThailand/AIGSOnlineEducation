import { getPublicPrice } from "@/lib/stripe/public-price";
import Image from "next/image";
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
  "id" | "title" | "description" | "excerpt" | "thumbnail_url" | "access_type" | "created_at" | "stripe_price_id"
>;

export default async function HomePage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? getRoleDashboardPath(user.profile?.role) : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, description, excerpt, thumbnail_url, access_type, stripe_price_id, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(6);
  const courses = await Promise.all(((data || []) as Course[]).map(async (course) => ({ ...course, price: await getPublicPrice(course.stripe_price_id) })));

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
      <section className="relative isolate overflow-hidden bg-[var(--brand-dark)] text-white">
        <Image
          src="/images/hero/placeholder.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/65" aria-hidden />
        <div className="public-container relative grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <p className="mb-4 text-sm font-bold">
              Discover courses in gems, grading &amp; jewelry
            </p>
            <form action="/courses" role="search" className="flex bg-white p-1">
              <label htmlFor="home-course-search" className="sr-only">
                Search courses
              </label>
              <input
                id="home-course-search"
                type="search"
                name="q"
                placeholder="What would you like to learn?"
                className="min-w-0 flex-1 px-4 py-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
              />
              <button
                type="submit"
                className="bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700"
              >
                Search
              </button>
            </form>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <a href="/courses" className="font-bold underline underline-offset-4">
                Explore all courses →
              </a>
              <a href="#learning-help" className="underline underline-offset-4">
                New to AIGS? Start here
              </a>
            </div>
          </div>
          <div className="bg-[var(--brand-dark)]/90 border-l-4 border-brand-500 p-7 sm:p-9">
            <h1 className="text-3xl font-bold uppercase leading-tight sm:text-4xl">
              Explore the world
              <br className="hidden sm:block" /> of gemstones.
            </h1>
            <p className="mt-5 text-base leading-7 text-white/90">
              Build your expertise with online learning from the Asian Institute of Gemological
              Sciences.
            </p>
            <a
              href="#about-aigs"
              className="mt-5 inline-block text-sm font-bold uppercase underline underline-offset-4"
            >
              Discover AIGS
            </a>
          </div>
        </div>
      </section>
      <section className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="public-container flex flex-col justify-between gap-4 py-7 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-bold">Learn more, one course at a time.</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Explore individual courses or build your knowledge with a course bundle.
            </p>
          </div>
          <PublicLinkButton href="/courses?kind=bundle" variant="secondary">
            Explore bundles <ArrowRight className="h-4 w-4" aria-hidden />
          </PublicLinkButton>
        </div>
      </section>
      <section id="course-highlights" className="public-container public-section scroll-mt-24">
        <SectionHeader
          eyebrow="AIGS Online Education"
          title="Explore our courses"
          description="Browse published AIGS courses. Explore the curriculum before you enroll."
          action={
            <PublicLinkButton href="/courses" variant="tertiary">
              View all courses <ArrowRight className="h-4 w-4" aria-hidden />
            </PublicLinkButton>
          }
        />
        {error ? (
          <div
            className="rounded-sm border border-[var(--border)] bg-[var(--surface-muted)] p-8"
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

      <section className="border-y border-[var(--border)] bg-[var(--surface-muted)]">
        <div className="public-container py-12">
          <h2 className="text-3xl font-bold">Discover a subject</h2>
          <p className="mt-3 text-[var(--text-secondary)]">Find your next area of expertise.</p>
          <div className="mt-7 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Ruby & sapphire", "ruby"],
              ["Diamond grading", "diamond"],
              ["Emeralds", "emerald"],
              ["Gem identification", "identification"],
              ["Grading & pricing", "grading"],
              ["Jewelry sketching", "sketching"],
            ].map(([label, query]) => (
              <a
                key={query}
                href={`/courses?q=${encodeURIComponent(query)}`}
                className="flex items-center justify-between border-b border-[var(--border)] py-4 font-bold text-brand-700 hover:underline"
              >
                {label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </section>
      <section id="learning-help" className="public-container scroll-mt-28 py-14">
        <h2 className="text-3xl font-bold">Your learning starts here</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            [
              "01",
              "Find your course",
              "Search the catalog and review the curriculum to find the right subject for you.",
            ],
            [
              "02",
              "Explore before enrolling",
              "Look for free lesson previews and check each course’s access conditions.",
            ],
            [
              "03",
              "Build your knowledge",
              "Sign in to access your enrolled courses, track progress, and continue learning.",
            ],
          ].map(([number, title, text]) => (
            <div key={number} className="border-t-2 border-brand-600 pt-5">
              <p className="text-sm font-bold text-brand-700">{number}</p>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section id="about-aigs" className="bg-[var(--surface-muted)]">
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

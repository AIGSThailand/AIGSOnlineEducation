import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { PublicLayout } from "@/components/public/public-layout";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicLayout mainClassName="auth-pages flex-1 bg-[var(--surface-muted)]">
      <div className="public-container py-8 sm:py-12">
        <Link
          href="/courses"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to courses
        </Link>
        <div className="mx-auto grid max-w-5xl items-start gap-10 py-6 sm:py-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <aside className="hidden py-8 lg:block">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-700">
              AIGS Online Education
            </p>
            <h2 className="mt-5 text-3xl font-bold leading-tight">
              Your next discovery
              <br />
              starts here.
            </h2>
            <p className="mt-5 max-w-sm text-base leading-7 text-[var(--text-secondary)]">
              Explore gemology, develop your expertise, and pick up where you left off.
            </p>
            <div className="mt-8 border-t border-[var(--border)] pt-6">
              <BookOpen className="mb-3 h-6 w-6 text-brand-700" aria-hidden />
              <h3 className="font-bold">One place for your learning</h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                Access your enrolled courses, learning materials, and progress through your AIGS
                account.
              </p>
              <Link
                href="/courses"
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700 hover:underline"
              >
                Explore the catalog <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </aside>
          <div className="w-full min-w-0 border border-t-4 border-[var(--border)] border-t-brand-600 bg-white p-6 sm:p-10">
            <p className="mb-6 text-xs font-bold uppercase tracking-widest text-brand-700">
              Your AIGS account
            </p>
            {children}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";
import { BookOpen, ShieldCheck, CreditCard, Sparkles, ArrowRight } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  const dashboardHref = user ? getRoleDashboardPath(user.profile?.role) : "/login";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              A
            </div>
            <span className="text-xl font-bold text-slate-900">AIGS LMS</span>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <Link href={dashboardHref}>
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <div className="mb-6 inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Next.js App Router • Supabase RLS • Stripe Integration
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Modern Online Education Management System
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            A production-ready learning management platform replacing legacy WordPress + LearnDash.
            Engineered for high performance, role-based security, and subscription billing.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-4">
            {user ? (
              <Link href={dashboardHref}>
                <Button size="lg" className="px-8">
                  Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="px-8">
                    Create Account
                  </Button>
                </Link>
                <Link href="/courses">
                  <Button variant="outline" size="lg">
                    Browse Courses
                  </Button>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Feature Grid */}
        <section className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Role-Based Security</h3>
              <p className="mt-2 text-sm text-slate-600">
                Granular Row Level Security (RLS) and server middleware protecting Admin,
                Instructor, and Student portals.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Stripe Subscriptions</h3>
              <p className="mt-2 text-sm text-slate-600">
                Automated webhook reconciliation supporting existing and new subscribers without
                interrupting access.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">LearnDash Migration Ready</h3>
              <p className="mt-2 text-sm text-slate-600">
                Pre-structured legacy ID columns to seamlessly import courses, lessons, and student
                progress from WordPress.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        © 2026 AIGS Online Education Platform. Production Next.js Architecture.
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PublicLayout } from "@/components/public/public-layout";
import { PublicLinkButton } from "@/components/public/public-button";
import { CreateTicketForm } from "@/components/support/create-ticket-form";
import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Contact us | AIGS Online Education" };

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <PublicLayout
      dashboardHref={user ? getRoleDashboardPath(user.profile?.role) : undefined}
      mainClassName="flex-1 bg-[var(--surface-muted)]"
    >
      <div className="public-container max-w-6xl py-10 sm:py-14">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm">
          <Link href="/help" className="text-brand-700 hover:underline">
            Help &amp; FAQs
          </Link>
          <span className="mx-3" aria-hidden>
            /
          </span>
          <span>Contact us</span>
        </nav>
        <h1 className="text-3xl font-bold sm:text-4xl">Contact us</h1>
        <p className="mt-4 max-w-2xl leading-7 text-[var(--text-secondary)]">
          Ask a question, get help with a course, or share feedback with the AIGS team.
        </p>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_1.6fr]">
          <aside className="space-y-8">
            <section>
              <h2 className="text-xl font-bold">Find an answer first</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                Our help center covers account access, course previews, learning materials, and
                certificates.
              </p>
              <PublicLinkButton href="/help" variant="tertiary" className="mt-3">
                Browse Help &amp; FAQs →
              </PublicLinkButton>
            </section>
            <section className="border-t border-[var(--border)] pt-6">
              <h2 className="text-xl font-bold">Email AIGS</h2>
              <a
                href="mailto:education@aigsthailand.com"
                className="mt-3 inline-block break-all text-sm font-bold text-brand-700 underline underline-offset-4"
              >
                education@aigsthailand.com
              </a>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">Bangkok, Thailand</p>
            </section>
            <section className="border-t border-[var(--border)] pt-6">
              <h2 className="text-lg font-bold">What to include</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                Include the course and lesson title, what happened, and any error message. Never
                include your password or payment card details.
              </p>
            </section>
          </aside>
          <section className="auth-pages border border-t-4 border-[var(--border)] border-t-brand-600 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-bold">Submit a request</h2>
            {user ? (
              <>
                <p className="mb-6 mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  Your request will be linked to your account. You can track replies in Support.
                </p>
                <CreateTicketForm />
                <Link
                  href="/student/support"
                  className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-brand-700 underline"
                >
                  View your support tickets
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">
                  Sign in to submit a support ticket and track replies from your account. If you
                  need help signing in or have a question before enrolling, email us directly.
                </p>
                <PublicLinkButton href="/login?redirect=/contact" className="mt-6 w-full">
                  Sign in to submit a request
                </PublicLinkButton>
                <a
                  href="mailto:education@aigsthailand.com"
                  className="mt-3 flex min-h-11 items-center justify-center border border-[var(--border-strong)] px-4 py-3 text-sm font-bold text-brand-700 hover:bg-[var(--surface-muted)]"
                >
                  Email us instead
                </a>
                <p className="mt-4 text-xs leading-6 text-[var(--text-secondary)]">
                  The email link opens your email app. Send your message there to contact the team.
                </p>
                <Link
                  href="/forgot-password"
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-brand-700 underline"
                >
                  Need to reset your password?
                </Link>
              </>
            )}
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}

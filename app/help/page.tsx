import type { Metadata } from "next";
import { PublicLayout } from "@/components/public/public-layout";
import { HelpFaqs } from "@/components/public/help-faqs";
import { PublicLinkButton } from "@/components/public/public-button";
import { getCurrentUser } from "@/lib/auth/permissions";
import { getRoleDashboardPath } from "@/lib/auth/redirects";

export const metadata: Metadata = { title: "Help & FAQs | AIGS Online Education" };

export default async function HelpPage() {
  const user = await getCurrentUser();
  return (
    <PublicLayout
      dashboardHref={user ? getRoleDashboardPath(user.profile?.role) : undefined}
      mainClassName="flex-1 bg-[var(--surface-muted)]"
    >
      <div className="public-container max-w-6xl py-12 sm:py-16">
        <div className="mb-8 text-center">
          <p className="public-eyebrow">AIGS Help Center</p>
          <h1 className="mt-4 text-3xl font-bold sm:text-4xl">How can we help?</h1>
          <p className="mt-4 text-[var(--text-secondary)]">
            Find answers about your account, courses, and learning materials.
          </p>
        </div>
        <HelpFaqs />
        <section className="mt-12 border-t border-[var(--border)] pt-10 text-center">
          <h2 className="text-2xl font-bold">Can’t find what you’re looking for?</h2>
          <p className="mt-3 text-[var(--text-secondary)]">Get in touch with the AIGS team.</p>
          <PublicLinkButton href="/contact" className="mt-6">
            Contact us
          </PublicLinkButton>
        </section>
      </div>
    </PublicLayout>
  );
}

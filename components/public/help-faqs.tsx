"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ArrowRight } from "lucide-react";

const categories = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I find the right course?",
        a: "Browse the course catalog or search by a subject such as ruby, diamond, or jewelry. Open a course to review its description and curriculum before enrolling.",
        href: "/courses",
        link: "Explore courses",
      },
      {
        q: "Can I preview a course before enrolling?",
        a: "Some courses offer free lesson previews. Look for the Free preview link in the course curriculum. Preview availability varies by course.",
      },
      {
        q: "Do I need an account?",
        a: "You can browse the catalog without signing in. Create an account to manage your enrollments and learning progress.",
        href: "/register",
        link: "Create an account",
      },
    ],
  },
  {
    title: "Account & access",
    items: [
      {
        q: "I forgot my password. What should I do?",
        a: "Request a password reset using your account email address. Open the link from your email in the same browser where you requested it.",
        href: "/forgot-password",
        link: "Reset your password",
      },
      {
        q: "Where can I find my courses?",
        a: "Sign in and open My Learning to see your courses and continue studying. If an expected course is missing, contact support with the course title.",
        href: "/login",
        link: "Sign in",
      },
      {
        q: "How long can I access a course?",
        a: "Access conditions vary by course. Review the course description and enrollment information for its access period. Contact support if you need help checking your enrollment.",
      },
    ],
  },
  {
    title: "Learning & course materials",
    items: [
      {
        q: "Where are lesson files and transcripts?",
        a: "Open an available lesson to see its video and supplementary content. Resources and transcripts are shown when provided for that lesson.",
      },
      {
        q: "What should I do if a video does not play?",
        a: "Check your internet connection, refresh the page, and try an up-to-date browser. If the issue continues, contact support with the course, lesson title, browser, and a description of the problem.",
        href: "/contact",
        link: "Contact support",
      },
      {
        q: "Will I receive a certificate?",
        a: "Certificate eligibility and assessment requirements depend on the course or program. Review its description for the requirements that apply to you.",
      },
    ],
  },
];

export function HelpFaqs() {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const filtered = categories.map((category) => ({
    ...category,
    items: category.items.filter((item) =>
      `${item.q} ${item.a} ${category.title}`.toLowerCase().includes(term)
    ),
  }));
  const count = filtered.reduce((sum, category) => sum + category.items.length, 0);
  return (
    <>
      <div className="mx-auto mb-10 flex max-w-2xl items-center border border-[var(--border-strong)] bg-white px-4">
        <Search className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
        <label htmlFor="faq-search" className="sr-only">
          Search help and FAQs
        </label>
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for help with your courses or account"
          className="min-w-0 flex-1 px-3 py-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        />
      </div>
      <nav aria-label="Help categories" className="mb-12 grid gap-4 md:grid-cols-3">
        {categories.map((category, index) => (
          <a
            key={category.title}
            href={`#help-category-${index}`}
            onClick={() => setQuery("")}
            className="flex min-h-24 items-center justify-between gap-4 border border-[var(--border)] bg-white p-6 font-bold hover:border-brand-600 hover:text-brand-700"
          >
            {category.title}
            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
          </a>
        ))}
      </nav>
      <p role="status" className="mb-5 text-sm text-[var(--text-secondary)]">
        {term
          ? `${count} ${count === 1 ? "answer" : "answers"} matching “${query.trim()}”`
          : "Find answers to common questions"}
      </p>
      <div className="space-y-10">
        {filtered.map(
          (category, index) =>
            category.items.length > 0 && (
              <section id={`help-category-${index}`} key={category.title} className="scroll-mt-28">
                <h2 className="mb-4 text-2xl font-bold">{category.title}</h2>
                <div className="divide-y divide-[var(--border)] border border-[var(--border)] bg-white">
                  {category.items.map((item) => (
                    <details
                      key={`${term}-${item.q}`}
                      open={term ? true : undefined}
                      className="group p-5 sm:px-7"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-bold [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <ChevronDown
                          className="h-5 w-5 shrink-0 text-brand-700 group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">
                        {item.a}
                      </p>
                      {"href" in item && (
                        <Link
                          href={item.href!}
                          className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-brand-700 underline underline-offset-4"
                        >
                          {item.link}
                        </Link>
                      )}
                    </details>
                  ))}
                </div>
              </section>
            )
        )}
        {count === 0 && (
          <div className="border border-[var(--border)] bg-white p-8">
            <h2 className="text-xl font-bold">No matching answers</h2>
            <p className="mt-3 text-sm">Try a shorter search, such as “password” or “video”.</p>
            <button
              onClick={() => setQuery("")}
              className="mt-4 min-h-11 font-bold text-brand-700 underline"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </>
  );
}

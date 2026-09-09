import Link from "next/link";
import { Gem, ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site grid min-h-screen bg-white lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand-900 p-12 text-white lg:flex xl:p-16">
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-widest">
          <Gem className="h-8 w-8" aria-hidden="true" />
          AIGS
        </Link>
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-widest text-brand-200">AIGS Online Education</p>
          <h2 className="mt-6 font-serif text-5xl leading-tight">
            Keep your curiosity.
            <br />
            <span className="italic text-brand-200">Grow your knowledge.</span>
          </h2>
          <p className="mt-6 text-base leading-8 text-brand-100">
            Your courses, lessons, and learning progress. All in one place.
          </p>
        </div>
        <p className="text-sm text-brand-200">A closer look. A deeper understanding.</p>
      </aside>
      <main id="main-content" className="flex flex-col px-5 py-8 sm:px-12">
        <Link
          href="/courses"
          className="inline-flex w-fit items-center gap-2 rounded py-2 text-sm text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to courses
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <Link
            href="/"
            className="mb-8 flex items-center gap-2 text-xl font-bold text-brand-800 lg:hidden"
          >
            <Gem className="h-7 w-7" aria-hidden="true" />
            AIGS
          </Link>
          {children}
        </div>
        <p className="text-center text-xs text-slate-500">AIGS Online Education</p>
      </main>
    </div>
  );
}

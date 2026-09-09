import Link from "next/link";
import { BrandLogo } from "@/components/public/brand-logo";

const EXPLORE = [
  { href: "/courses", label: "Courses" },
  { href: "/#about-aigs", label: "About AIGS" },
] as const;

const ACCOUNT = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create account" },
] as const;

export function PublicFooter() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--brand-dark)] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <BrandLogo variant="white" />
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/75">
            Asian Institute of Gemological Sciences — professional gemology education for an
            international audience.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">
            Explore
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {EXPLORE.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/80 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">
            Account
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {ACCOUNT.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/80 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">
            Contact
          </p>
          <address className="mt-4 space-y-2 text-sm not-italic leading-6 text-white/80">
            <p>Bangkok, Thailand</p>
            <p>
              <a className="hover:text-white" href="mailto:education@aigsthailand.com">
                education@aigsthailand.com
              </a>
            </p>
          </address>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {year} Asian Institute of Gemological Sciences. All rights reserved.</p>
          <p>AIGS Online Education</p>
        </div>
      </div>
    </footer>
  );
}

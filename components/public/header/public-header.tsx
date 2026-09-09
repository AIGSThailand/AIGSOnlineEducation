"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Gem, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicLinkButton } from "@/components/public/public-button";

const NAV = [
  { href: "/courses", label: "Courses" },
  { href: "/#about-aigs", label: "About" },
] as const;

export function PublicHeader({
  dashboardHref,
  userLabel,
}: {
  dashboardHref?: string;
  userLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const linkClass = (href: string) =>
    cn(
      "rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]",
      (href === "/courses" && pathname.startsWith("/courses")) ||
        (href !== "/courses" && pathname === href)
        ? "text-[var(--brand-primary)]"
        : null
    );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/90">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          aria-label="AIGS Online Education home"
          className="flex items-center gap-2.5 text-[var(--text-primary)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-primary)] text-white">
            <Gem className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-[0.14em]">AIGS</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Online Education
            </span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {dashboardHref ? (
            <>
              <Link href={dashboardHref} className={linkClass(dashboardHref)}>
                My Learning
              </Link>
              <PublicLinkButton href={dashboardHref} variant="primary">
                {userLabel || "Dashboard"}
              </PublicLinkButton>
            </>
          ) : (
            <>
              <Link href="/login" className={linkClass("/login")}>
                Sign in
              </Link>
              <PublicLinkButton href="/register" variant="primary">
                Get started
              </PublicLinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(linkClass(item.href), "px-3")}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {dashboardHref ? (
              <PublicLinkButton href={dashboardHref} className="mt-3 w-full">
                My Learning
              </PublicLinkButton>
            ) : (
              <>
                <Link href="/login" className={cn(linkClass("/login"), "px-3")} onClick={() => setOpen(false)}>
                  Sign in
                </Link>
                <PublicLinkButton href="/register" className="mt-3 w-full">
                  Get started
                </PublicLinkButton>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

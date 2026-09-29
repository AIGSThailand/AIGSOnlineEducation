import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

function LoginFormFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-10 animate-pulse rounded-md bg-slate-100" />
      <div className="h-10 animate-pulse rounded-md bg-slate-100" />
      <div className="h-10 animate-pulse rounded-md bg-slate-100" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold leading-tight text-[var(--text-primary)]">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Access your courses, dashboard, and learning materials
        </p>
      </div>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>

      <div className="mt-7 border-t border-[var(--border)] pt-6 text-sm leading-6 text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}

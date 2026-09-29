import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold leading-tight text-[var(--text-primary)]">
          Create your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Create an account to manage your courses and learning progress.
        </p>
      </div>

      <RegisterForm />

      <div className="mt-7 border-t border-[var(--border)] pt-6 text-sm leading-6 text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

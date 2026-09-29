import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-3xl font-bold leading-tight text-[var(--text-primary)]">
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Enter your email to receive password reset instructions
        </p>
      </div>

      <ForgotPasswordForm />

      <div className="mt-7 border-t border-[var(--border)] pt-6 text-sm leading-6 text-[var(--text-secondary)]">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

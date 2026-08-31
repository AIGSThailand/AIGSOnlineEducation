import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Reset Password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter your email to receive password reset instructions
        </p>
      </div>

      <ForgotPasswordForm />

      <div className="mt-6 text-center text-sm text-slate-600">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-600 hover:text-brand-500"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

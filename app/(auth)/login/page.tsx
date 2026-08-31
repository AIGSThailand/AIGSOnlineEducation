import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign In to Your Account
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Access your courses, dashboard, and learning materials
        </p>
      </div>

      <LoginForm />

      <div className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand-600 hover:text-brand-500"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}

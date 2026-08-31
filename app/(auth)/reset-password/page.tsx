import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Choose a New Password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Please enter and confirm your new secure password
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}

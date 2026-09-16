import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SearchParams = { code?: string };

/**
 * Recovery emails may still point here with ?code= — forward to the PKCE callback.
 * After exchange, callback returns here with a recovery session so updateUser works.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const code = searchParams.code?.trim();
  if (code) {
    redirect(
      `/api/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/reset-password")}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Reset link required
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Open the password reset link from your email in this browser (same device where you
          requested the reset). Links expire after use.
        </p>
        <div className="mt-6 space-y-2">
          <Link href="/forgot-password" className="block w-full">
            <Button className="w-full">Request a new reset link</Button>
          </Link>
          <Link href="/login" className="block w-full">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Choose a New Password</h2>
        <p className="mt-1 text-sm text-slate-600">
          Please enter and confirm your new secure password
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}

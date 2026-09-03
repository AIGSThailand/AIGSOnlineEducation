import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthCodeErrorPage() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Authentication Link Expired
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        The verification or password reset link has expired or has already been used. Please request
        a new one.
      </p>
      <div className="mt-6 space-y-2">
        <Link href="/login" className="block w-full">
          <Button className="w-full">Return to Sign In</Button>
        </Link>
        <Link href="/forgot-password" className="block w-full">
          <Button variant="outline" className="w-full">
            Request New Reset Link
          </Button>
        </Link>
      </div>
    </div>
  );
}

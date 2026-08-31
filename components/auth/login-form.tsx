"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const errorParam = searchParams.get("error");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam === "unauthorized" ? "You do not have permission to access that area." : null
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const result = await loginAction(formData);

    if (!result.success) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    const destination = redirectParam || result.redirectUrl || "/student/dashboard";
    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Sign In Failed">
          {errorMessage}
        </Alert>
      )}

      <div>
        <Label htmlFor="email" required>
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label htmlFor="password" required className="mb-0">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Sign In
      </Button>
    </form>
  );
}

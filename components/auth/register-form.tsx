"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await registerAction(formData);

      if (!result.success) {
        setErrorMessage(result.error);
        setIsLoading(false);
        // Existing account → send to login after a short moment so the message is readable
        if (result.redirectUrl?.includes("/login")) {
          window.setTimeout(() => {
            router.push(result.redirectUrl!);
            router.refresh();
          }, 1200);
        }
        return;
      }

      if (result.message) {
        setSuccessMessage(result.message);
        setIsLoading(false);
        if (result.redirectUrl) {
          window.setTimeout(() => {
            router.push(result.redirectUrl!);
            router.refresh();
          }, 1500);
        }
        return;
      }

      if (result.redirectUrl) {
        router.push(result.redirectUrl);
        router.refresh();
        return;
      }

      setErrorMessage("Registration completed, but no redirect was provided. Please sign in.");
      setIsLoading(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Registration Error">
          {errorMessage}{" "}
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Account Created">
          {successMessage} Redirecting to sign in…
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName" required>
            First name
          </Label>
          <Input id="firstName" name="firstName" placeholder="Jane" required />
        </div>
        <div>
          <Label htmlFor="lastName" required>
            Last name
          </Label>
          <Input id="lastName" name="lastName" placeholder="Doe" required />
        </div>
      </div>

      <div>
        <Label htmlFor="email" required>
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="jane.doe@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <Label htmlFor="password" required>
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          required
        />
      </div>

<Button type="submit" className="w-full" isLoading={isLoading}>
        Create Account
      </Button>
    </form>
  );
}


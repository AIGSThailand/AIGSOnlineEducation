"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

    const formData = new FormData(event.currentTarget);
    const result = await registerAction(formData);

    if (!result.success) {
      setErrorMessage(result.error);
      setIsLoading(false);
      return;
    }

    if (result.message) {
      setSuccessMessage(result.message);
      setIsLoading(false);
      return;
    }

    if (result.redirectUrl) {
      router.push(result.redirectUrl);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Registration Error">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Account Created">
          {successMessage}
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

      <div>
        <Label htmlFor="role" required>
          I am registering as:
        </Label>
        <select
          id="role"
          name="role"
          className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          defaultValue="student"
        >
          <option value="student">Student / Learner</option>
          <option value="instructor">Instructor / Educator</option>
        </select>
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Create Account
      </Button>
    </form>
  );
}

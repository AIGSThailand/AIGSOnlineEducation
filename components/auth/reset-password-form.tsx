"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ResetPasswordForm() {
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
    const result = await resetPasswordAction(formData);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }

    setSuccessMessage(result.message || "Password updated successfully.");
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Reset Failed">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Success">
          {successMessage} Redirecting to login...
        </Alert>
      )}

      <div>
        <Label htmlFor="password" required>
          New Password
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
        <Label htmlFor="confirmPassword" required>
          Confirm New Password
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repeat new password"
          autoComplete="new-password"
          required
        />
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Set New Password
      </Button>
    </form>
  );
}

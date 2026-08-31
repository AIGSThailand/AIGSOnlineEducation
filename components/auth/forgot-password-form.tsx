"use client";

import { useState } from "react";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const result = await forgotPasswordAction(formData);

    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }

    setSuccessMessage(result.message || "Password reset link sent to your email.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <Alert variant="error" title="Error">
          {errorMessage}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" title="Check your inbox">
          {successMessage}
        </Alert>
      )}

      <div>
        <Label htmlFor="email" required>
          Account Email
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

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Send Reset Link
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateAccountProfileAction } from "@/features/settings/actions";

export function AccountSettingsForm({
  firstName,
  lastName,
  email,
}: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateAccountProfileAction({
        firstName: first,
        lastName: last,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <Label htmlFor="account-email">Email</Label>
          <Input id="account-email" value={email} disabled />
          <p className="mt-1 text-xs text-slate-500">Email is managed by your login account.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="account-first">First name</Label>
            <Input
              id="account-first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="account-last">Last name</Label>
            <Input id="account-last" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Profile saved.</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Password</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use the password reset flow to change your password securely.
        </p>
        <Link
          href="/forgot-password"
          className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Reset password →
        </Link>
      </div>
    </div>
  );
}

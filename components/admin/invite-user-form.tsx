"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { inviteUserAction } from "@/features/users/actions";
import type { UserRole } from "@/types/database.types";

export function InviteUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await inviteUserAction({ email, firstName, lastName, role });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage(`Invite sent to ${email}.`);
      setEmail("");
      setFirstName("");
      setLastName("");
      setRole("student");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Invite user</h2>
        <p className="text-xs text-slate-500">
          Sends a Supabase invite email. Role is applied when the profile is created.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="learner@example.com"
          />
        </div>
        <div>
          <Label htmlFor="invite-first">First name</Label>
          <Input
            id="invite-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="invite-last">Last name</Label>
          <Input id="invite-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { updateUserRoleAction } from "@/features/users/actions";
import type { UserRole } from "@/types/database.types";

export function UserRoleSelect({
  userId,
  email,
  role,
  isSelf,
}: {
  userId: string;
  email: string;
  role: UserRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState<UserRole>(role);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onChange(next: UserRole) {
    if (next === value) return;

    const label = `${email}${isSelf ? " (you)" : ""}`;
    const ok = window.confirm(
      `Change role for ${label} from “${value}” to “${next}”?\n\nThis immediately affects portal access.`
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await updateUserRoleAction({ userId, role: next });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setValue(next);
      router.refresh();
    });
  }

  return (
    <div className="min-w-[9rem]">
      <Select
        aria-label={`Role for ${email}`}
        value={value}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as UserRole)}
        className="h-9 text-xs"
      >
        <option value="student">Student</option>
        <option value="instructor">Instructor</option>
        <option value="admin">Admin</option>
      </Select>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
      {isPending ? <p className="mt-1 text-xs text-slate-500">Saving…</p> : null}
    </div>
  );
}

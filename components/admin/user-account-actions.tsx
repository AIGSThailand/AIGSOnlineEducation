"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getUserAuthActivityAction,
  resendConfirmationAction,
  sendPasswordResetAction,
  setUserBanAction,
} from "@/features/users/actions";
import { formatDateTime } from "@/lib/utils";
import type { UserAuthActivityEvent } from "@/features/users/types";

export function UserAccountActions({
  userId,
  emailConfirmed,
  isBanned,
  isSelf,
}: {
  userId: string;
  emailConfirmed: boolean;
  isBanned: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<UserAuthActivityEvent[] | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(action: "reset" | "confirm" | "ban" | "unban" | "activity") {
    setMessage(null);
    setError(null);

    if (action === "ban") {
      const ok = window.confirm(
        "Ban this user? They will not be able to sign in until you unban them."
      );
      if (!ok) return;
    }

    startTransition(async () => {
      if (action === "activity") {
        const result = await getUserAuthActivityAction(userId);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setActivity(result.data || []);
        setActivityOpen(true);
        return;
      }

      const result =
        action === "reset"
          ? await sendPasswordResetAction({ userId })
          : action === "confirm"
            ? await resendConfirmationAction({ userId })
            : await setUserBanAction({ userId, banned: action === "ban" });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (action === "reset") setMessage("Password reset email sent.");
      else if (action === "confirm") setMessage("Confirmation email resent.");
      else if (action === "ban") setMessage("User banned.");
      else setMessage("User unbanned.");

      if (action === "ban" || action === "unban") {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run("reset")}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          Reset password
        </button>
        {!emailConfirmed ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run("confirm")}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
          >
            Resend confirm
          </button>
        ) : null}
        {!isSelf ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(isBanned ? "unban" : "ban")}
            className={
              isBanned
                ? "text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                : "text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
            }
          >
            {isBanned ? "Unban" : "Ban"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (activityOpen) {
              setActivityOpen(false);
              return;
            }
            run("activity");
          }}
          className="text-xs font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
        >
          {activityOpen ? "Hide activity" : "Login activity"}
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {activityOpen ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          {activity && activity.length > 0 ? (
            <ul className="space-y-1">
              {activity.map((ev) => (
                <li key={ev.id}>
                  <span className="font-medium text-slate-800">{ev.action}</span>
                  <span className="mx-1 text-slate-400">·</span>
                  {formatDateTime(ev.createdAt)}
                  {ev.ipAddress ? (
                    <>
                      <span className="mx-1 text-slate-400">·</span>
                      <span className="font-mono">{ev.ipAddress}</span>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No Auth audit events found. Enable Postgres Auth audit log storage in the Supabase
              project if you expect login history here.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  replySupportTicketAction,
  updateSupportTicketStatusAction,
} from "@/features/support/actions";
import type { SupportMessageItem } from "@/features/support/types";
import type { SupportTicketStatus } from "@/types/database.types";

export function TicketThread({
  ticketId,
  messages,
  status,
  showStatusControls = false,
}: {
  ticketId: string;
  messages: SupportMessageItem[];
  status: SupportTicketStatus;
  showStatusControls?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [nextStatus, setNextStatus] = useState<SupportTicketStatus>(status);
  const [error, setError] = useState<string | null>(null);

  function onReply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await replySupportTicketAction({ ticketId, body });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function onStatusChange() {
    startTransition(async () => {
      const result = await updateSupportTicketStatusAction({
        ticketId,
        status: nextStatus,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-4 ${
              m.isStaff
                ? "border-brand-100 bg-brand-50/50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                {m.isStaff ? "Staff" : "You"}
                {m.authorName ? ` · ${m.authorName}` : ""}
              </span>
              <time>{new Date(m.createdAt).toLocaleString()}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>
          </div>
        ))}
      </div>

      {showStatusControls && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="ticket-status">Status</Label>
            <Select
              id="ticket-status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as SupportTicketStatus)}
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
          <Button type="button" variant="outline" disabled={isPending} onClick={onStatusChange}>
            Update status
          </Button>
        </div>
      )}

      {status !== "closed" && (
        <form onSubmit={onReply} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <Label htmlFor="reply-body">Reply</Label>
          <textarea
            id="reply-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Write a reply…"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      )}
    </div>
  );
}

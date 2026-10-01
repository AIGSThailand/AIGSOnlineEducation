"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createSupportTicketAction } from "@/features/support/actions";
import { cn } from "@/lib/utils";
import type { SupportTicketPriority } from "@/types/database.types";

export function CreateTicketForm({
  plain = false,
  initialSubject = "",
  initialBody = "",
}: {
  plain?: boolean;
  initialSubject?: string;
  initialBody?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createSupportTicketAction({ subject, body, priority });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/student/support/${result.data!.id}`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-4",
        plain ? "" : "rounded-sm border border-[var(--border)] bg-white p-4"
      )}
    >
      <div>
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="I need help with…"
        />
      </div>
      <div>
        <Label htmlFor="ticket-priority">Priority</Label>
        <Select
          id="ticket-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="ticket-body">Message</Label>
        <textarea
          id="ticket-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          className={cn(
            "mt-1 w-full border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
            plain
              ? "rounded-sm border-[var(--border-strong)] shadow-none"
              : "rounded-sm border-[var(--border-strong)] shadow-none"
          )}
          placeholder="Describe your issue…"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button
        type="submit"
        disabled={isPending}
        className={plain ? "rounded-sm font-bold shadow-none" : undefined}
      >
        {isPending ? "Submitting…" : "Submit ticket"}
      </Button>
    </form>
  );
}

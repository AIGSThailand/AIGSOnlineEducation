"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/courses/builder/rich-text-editor";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  deleteAnnouncementAction,
} from "@/features/announcements/actions";
import type { AnnouncementListItem } from "@/features/announcements/types";
import type { AnnouncementAudience, AnnouncementStatus } from "@/types/database.types";

type Mode = { kind: "create" } | { kind: "edit"; announcement: AnnouncementListItem };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AnnouncementForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const a = mode.kind === "edit" ? mode.announcement : null;
  const [title, setTitle] = useState(a?.title || "");
  const [bodyHtml, setBodyHtml] = useState(a?.bodyHtml || "");
  const [status, setStatus] = useState<AnnouncementStatus>(a?.status || "draft");
  const [audience, setAudience] = useState<AnnouncementAudience>(a?.audience || "all");
  const [startsAt, setStartsAt] = useState(toLocalInput(a?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(a?.endsAt ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      if (mode.kind === "create") {
        const result = await createAnnouncementAction({
          title,
          bodyHtml,
          status,
          audience,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
        });
        if (!result.success) {
          setError(result.error);
          return;
        }
        router.push(`/admin/announcements/${result.data!.id}`);
        return;
      }

      const result = await updateAnnouncementAction({
        announcementId: mode.announcement.id,
        title,
        bodyHtml,
        status,
        audience,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDelete() {
    if (mode.kind !== "edit") return;
    if (!confirm("Delete this announcement permanently?")) return;
    startTransition(async () => {
      const result = await deleteAnnouncementAction({
        announcementId: mode.announcement.id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/admin/announcements");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <Label htmlFor="ann-title">Title</Label>
        <Input
          id="ann-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Platform update"
        />
      </div>
      <div>
        <Label>Body</Label>
        <p className="mb-2 text-xs text-slate-500">Rich text shown to your audience.</p>
        <RichTextEditor
          value={bodyHtml}
          onChange={({ html }) => setBodyHtml(html)}
          placeholder="Write the announcement…"
          allowHtmlSource
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ann-status">Status</Label>
          <Select
            id="ann-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="ann-audience">Audience</Label>
          <Select
            id="ann-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
          >
            <option value="all">Everyone</option>
            <option value="students">Students</option>
            <option value="instructors">Instructors</option>
            <option value="admins">Admins</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ann-starts">Starts at (optional)</Label>
          <Input
            id="ann-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ann-ends">Ends at (optional)</Label>
          <Input
            id="ann-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : mode.kind === "create" ? "Create" : "Save changes"}
        </Button>
        {mode.kind === "edit" && (
          <Button type="button" variant="outline" disabled={isPending} onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}

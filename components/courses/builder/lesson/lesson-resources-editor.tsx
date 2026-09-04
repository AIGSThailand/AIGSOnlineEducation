"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createLessonResourceAction,
  deleteLessonResourceAction,
  reorderLessonResourcesAction,
  updateLessonResourceAction,
  type LessonResourceForEdit,
} from "@/features/lessons/actions";
import type { lessonResourceTypeSchema } from "@/features/lessons/schema";
import type { z } from "zod";

type ResourceType = z.infer<typeof lessonResourceTypeSchema>;

interface LessonResourcesEditorProps {
  courseId: string;
  lessonId: string;
  resources: LessonResourceForEdit[];
  onChanged: () => void;
}

export function LessonResourcesEditor({
  courseId,
  lessonId,
  resources,
  onChanged,
}: LessonResourcesEditorProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("pdf");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function addResource() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const result = await createLessonResourceAction({
      courseId,
      lessonId,
      title,
      url,
      resourceType,
      isDownloadable: true,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTitle("");
    setUrl("");
    setAdding(false);
    onChanged();
  }

  async function rename(resourceId: string) {
    if (!editTitle.trim()) return;
    setBusy(true);
    const result = await updateLessonResourceAction({
      courseId,
      lessonId,
      resourceId,
      title: editTitle,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    onChanged();
  }

  async function remove(resourceId: string) {
    if (!window.confirm("Remove this resource?")) return;
    setBusy(true);
    const result = await deleteLessonResourceAction({ courseId, lessonId, resourceId });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  async function move(resourceId: string, direction: "up" | "down") {
    const ids = resources.map((r) => r.id);
    const index = ids.indexOf(resourceId);
    if (index < 0) return;
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= ids.length) return;
    const next = [...ids];
    [next[index], next[swap]] = [next[swap], next[index]];
    setBusy(true);
    const result = await reorderLessonResourcesAction({
      courseId,
      lessonId,
      resourceIds: next,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Resources</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            PDFs, links, and downloads attached to this lesson.
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAdding(true)}>
          + Add resource
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {adding && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div>
            <Label htmlFor="resource-title">Title</Label>
            <Input
              id="resource-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Color Grading Chart.pdf"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="resource-type">Type</Label>
              <Select
                id="resource-type"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value as ResourceType)}
              >
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
                <option value="spreadsheet">Spreadsheet</option>
                <option value="link">Link</option>
                <option value="download">Download</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="resource-url">URL</Label>
              <Input
                id="resource-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !title.trim()} onClick={() => void addResource()}>
              Save resource
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {resources.length === 0 && !adding ? (
        <p className="text-sm text-slate-500">No resources yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {resources.map((r, index) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                {editingId === r.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      aria-label="Rename resource"
                    />
                    <Button size="sm" disabled={busy} onClick={() => void rename(r.id)}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {r.resourceType}
                      {r.url ? (
                        <>
                          {" · "}
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-700 underline"
                          >
                            Open
                          </a>
                        </>
                      ) : null}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === 0}
                  onClick={() => void move(r.id, "up")}
                >
                  Up
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || index === resources.length - 1}
                  onClick={() => void move(r.id, "down")}
                >
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditingId(r.id);
                    setEditTitle(r.title);
                  }}
                >
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(r.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

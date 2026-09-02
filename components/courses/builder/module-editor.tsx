"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateModuleAction } from "@/features/courses/builder/actions";
import type { CourseStructureModuleItem, SaveStatus } from "@/features/courses/types";

interface ModuleEditorProps {
  courseId: string;
  module: CourseStructureModuleItem;
  onSaveStatusChange: (status: SaveStatus) => void;
  saveSignal?: number;
}

export function ModuleEditor({
  courseId,
  module,
  onSaveStatusChange,
  saveSignal,
}: ModuleEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(module.title);
    setDescription(module.description || "");
  }, [module]);

  const handleSave = () => {
    onSaveStatusChange("saving");
    setError(null);
    startTransition(async () => {
      const result = await updateModuleAction({
        courseId,
        moduleId: module.id,
        title,
        description,
      });
      if (result.success) {
        onSaveStatusChange("saved");
        router.refresh();
      } else {
        setError(result.error);
        onSaveStatusChange("error");
      }
    });
  };

  useEffect(() => {
    if (saveSignal && saveSignal > 0) handleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveSignal]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Module</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Edit module</h2>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="module-title">Title</Label>
          <Input
            id="module-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <div>
          <Label htmlFor="module-description">Description</Label>
          <Textarea
            id="module-description"
            value={description}
            rows={4}
            onChange={(e) => {
              setDescription(e.target.value);
              onSaveStatusChange("unsaved");
            }}
          />
        </div>
        <p className="text-xs text-slate-500">Sort order: {module.sortOrder + 1}</p>
      </div>

      <Button type="button" onClick={handleSave} isLoading={isPending}>
        Save module
      </Button>
    </div>
  );
}

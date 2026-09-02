"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createCourseAction } from "@/features/courses/actions";
import { slugifyTitle } from "@/features/courses/builder/ordering";
import type { BuilderPortal, InstructorOption } from "@/features/courses/types";

interface NewCourseFormProps {
  portal: BuilderPortal;
  instructors: InstructorOption[];
  isAdmin: boolean;
  defaultInstructorId?: string;
}

export function NewCourseForm({
  portal,
  instructors,
  isAdmin,
  defaultInstructorId,
}: NewCourseFormProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [instructorId, setInstructorId] = useState(defaultInstructorId || "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugifyTitle(value));
  };

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    formData.set("title", title);
    formData.set("slug", slug || slugifyTitle(title));
    formData.set("excerpt", excerpt);
    if (isAdmin && instructorId) formData.set("instructorId", instructorId);

    const result = await createCourseAction(portal, formData);
    if (result && !result.success) {
      setError(result.error);
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="mx-auto max-w-lg space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div>
        <Label htmlFor="new-title">Course title</Label>
        <Input
          id="new-title"
          required
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Diamond Grading Course"
        />
      </div>

      <div>
        <Label htmlFor="new-slug">URL slug</Label>
        <Input
          id="new-slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="diamond-grading-course"
        />
      </div>

      <div>
        <Label htmlFor="new-excerpt">Short description</Label>
        <Textarea
          id="new-excerpt"
          value={excerpt}
          rows={3}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Brief summary shown in course listings."
        />
      </div>

      {isAdmin && (
        <div>
          <Label htmlFor="new-instructor">Instructor</Label>
          <Select
            id="new-instructor"
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
          >
            <option value="">Select instructor (optional)</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {`${inst.firstName || ""} ${inst.lastName || ""}`.trim() || inst.email}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Button type="submit" isLoading={isPending} className="w-full">
        Create draft course
      </Button>
    </form>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateCourseAction,
  updateStripeMappingAction,
} from "@/features/courses/actions";
import type { CourseBuilderCourse, InstructorOption, SaveStatus } from "@/features/courses/types";

interface CourseSettingsProps {
  course: CourseBuilderCourse;
  instructors: InstructorOption[];
  isAdmin: boolean;
  onSaveStatusChange: (status: SaveStatus) => void;
}

export function CourseSettings({
  course,
  instructors,
  isAdmin,
  onSaveStatusChange,
}: CourseSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnailUrl || "");
  const [progressionType, setProgressionType] = useState(course.progressionType);
  const [instructorIds, setInstructorIds] = useState<string[]>(course.instructorIds);
  const [stripeProductId, setStripeProductId] = useState(course.stripeProductId || "");
  const [stripePriceId, setStripePriceId] = useState(course.stripePriceId || "");
  const [error, setError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    setThumbnailUrl(course.thumbnailUrl || "");
    setProgressionType(course.progressionType);
    setInstructorIds(course.instructorIds);
    setStripeProductId(course.stripeProductId || "");
    setStripePriceId(course.stripePriceId || "");
  }, [course]);

  const saveSettings = () => {
    onSaveStatusChange("saving");
    setError(null);
    startTransition(async () => {
      const result = await updateCourseAction({
        courseId: course.id,
        thumbnailUrl,
        progressionType,
        instructorIds: isAdmin ? instructorIds : undefined,
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

  const saveStripe = () => {
    setStripeError(null);
    startTransition(async () => {
      const result = await updateStripeMappingAction({
        courseId: course.id,
        stripeProductId,
        stripePriceId,
      });
      if (!result.success) setStripeError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Course settings</h2>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Publishing</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Status</span>
          <Badge variant={course.status === "published" ? "success" : "default"}>
            {course.status}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Use Publish or Archive in the header to change course status.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Access</h3>
        <p className="text-sm text-slate-600">
          Enrollment required for lesson access. Active students: {course.enrollmentCount}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Progression</h3>
        <Label htmlFor="progression-type">Course progression</Label>
        <Select
          id="progression-type"
          value={progressionType}
          onChange={(e) => setProgressionType(e.target.value as "linear" | "free_form")}
        >
          <option value="free_form">Free form</option>
          <option value="linear">Linear</option>
        </Select>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Media</h3>
        <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
        <Input
          id="thumbnail-url"
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://..."
        />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Instructor</h3>
          <Label htmlFor="instructor-select">Assigned instructor</Label>
          <Select
            id="instructor-select"
            value={instructorIds[0] || ""}
            onChange={(e) => setInstructorIds(e.target.value ? [e.target.value] : [])}
          >
            <option value="">Select instructor</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {`${inst.firstName || ""} ${inst.lastName || ""}`.trim() || inst.email}
              </option>
            ))}
          </Select>
        </section>
      )}

      {!isAdmin && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">Instructor</h3>
          <p className="text-sm text-slate-600">
            You are assigned to this course. Contact an admin to change instructor assignments.
          </p>
        </section>
      )}

      {isAdmin && (
        <section className="space-y-3 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Commerce (Admin)</h3>
          <Label htmlFor="stripe-product">Stripe product ID</Label>
          <Input
            id="stripe-product"
            value={stripeProductId}
            onChange={(e) => setStripeProductId(e.target.value)}
          />
          <Label htmlFor="stripe-price">Stripe price ID</Label>
          <Input
            id="stripe-price"
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
          />
          {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
          <Button type="button" variant="outline" size="sm" onClick={saveStripe} isLoading={isPending}>
            Save Stripe mapping
          </Button>
        </section>
      )}

      {isAdmin && course.wordpressCourseId && (
        <section className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Migration (read-only)</h3>
          <p className="text-xs font-mono text-slate-500">
            WordPress course ID: {course.wordpressCourseId}
          </p>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={saveSettings} isLoading={isPending}>
        Save settings
      </Button>
    </div>
  );
}

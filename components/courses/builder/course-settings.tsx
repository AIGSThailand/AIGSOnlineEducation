"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateCourseAction, updateStripeMappingAction } from "@/features/courses/actions";
import { MediaUploader } from "@/components/media/media-uploader";
import type {
  CourseBuilderCourse,
  CourseBuilderPermissions,
  InstructorOption,
  SaveStatus,
} from "@/features/courses/types";
import type { CourseAccessType, CourseProgressionType } from "@/types/database.types";
import { formatDateTime } from "@/lib/utils";

const AUTOSAVE_MS = 1200;

interface CourseSettingsProps {
  course: CourseBuilderCourse;
  instructors: InstructorOption[];
  isAdmin: boolean;
  permissions?: CourseBuilderPermissions;
  onSaveStatusChange: (status: SaveStatus) => void;
  onPublish?: () => void;
  onArchive?: () => void;
}

type SettingsForm = {
  thumbnailUrl: string;
  promotionalVideoUrl: string;
  progressionType: CourseProgressionType;
  accessType: CourseAccessType;
  instructorIds: string[];
};

export function CourseSettings({
  course,
  instructors,
  isAdmin,
  permissions,
  onSaveStatusChange,
  onPublish,
  onArchive,
}: CourseSettingsProps) {
  const canEditCommerce = permissions?.canEditCommerce ?? isAdmin;
  const canEditMigration = permissions?.canEditMigration ?? isAdmin;
  const canManageInstructors = permissions?.canManageInstructors ?? isAdmin;
  const canPublish = permissions?.canPublish ?? isAdmin;
  const canArchive = permissions?.canArchive ?? isAdmin;

  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<SettingsForm>(() => formFromCourse(course));
  const [stripeProductId, setStripeProductId] = useState(course.stripeProductId || "");
  const [stripePriceId, setStripePriceId] = useState(course.stripePriceId || "");
  const [error, setError] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);

  const formRef = useRef(form);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  formRef.current = form;
  dirtyRef.current = dirty;

  useEffect(() => {
    setForm(formFromCourse(course));
    setStripeProductId(course.stripeProductId || "");
    setStripePriceId(course.stripePriceId || "");
    setDirty(false);
    dirtyRef.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, [course]);

  const persistSettings = useCallback(async () => {
    const current = formRef.current;
    setIsSaving(true);
    onSaveStatusChange("saving");
    setError(null);

    const result = await updateCourseAction({
      courseId: course.id,
      thumbnailUrl: current.thumbnailUrl,
      promotionalVideoUrl: current.promotionalVideoUrl,
      progressionType: current.progressionType,
      accessType: current.accessType,
      instructorIds: canManageInstructors ? current.instructorIds : undefined,
    });

    setIsSaving(false);

    if (result.success) {
      setDirty(false);
      dirtyRef.current = false;
      onSaveStatusChange("saved");
      router.refresh();
    } else {
      setError(result.error);
      onSaveStatusChange("error");
    }
    return result;
  }, [canManageInstructors, course.id, onSaveStatusChange, router]);

  const scheduleAutosave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!dirtyRef.current) return;
      startTransition(() => {
        void persistSettings();
      });
    }, AUTOSAVE_MS);
  }, [persistSettings]);

  const patchForm = useCallback(
    (patch: Partial<SettingsForm>) => {
      setForm((prev) => ({ ...prev, ...patch }));
      setDirty(true);
      dirtyRef.current = true;
      onSaveStatusChange("unsaved");
      scheduleAutosave();
    },
    [onSaveStatusChange, scheduleAutosave]
  );

  const toggleInstructor = (id: string) => {
    const next = form.instructorIds.includes(id)
      ? form.instructorIds.filter((x) => x !== id)
      : [...form.instructorIds, id];
    patchForm({ instructorIds: next });
  };

  const saveStripe = () => {
    setStripeError(null);
    setStripeSaving(true);
    startTransition(async () => {
      const result = await updateStripeMappingAction({
        courseId: course.id,
        stripeProductId,
        stripePriceId,
      });
      setStripeSaving(false);
      if (!result.success) setStripeError(result.error);
      else {
        onSaveStatusChange("saved");
        router.refresh();
      }
    });
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const accessHint = ACCESS_HINTS[form.accessType];
  const commerceLooksPaid = Boolean(stripePriceId.trim());

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Course settings</h2>
        </div>
        <p className="text-xs text-slate-500" aria-live="polite">
          {isSaving ? "Saving…" : dirty ? "Unsaved" : "Autosave on"}
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <SettingsSection title="Publishing" defaultOpen>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Status</span>
          <Badge
            variant={
              course.status === "published"
                ? "success"
                : course.status === "archived"
                  ? "default"
                  : "warning"
            }
          >
            {course.status}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Draft courses are builder-only. Published courses appear in the catalog. Archive hides them
          from new enrollments.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {canPublish && course.status !== "published" && onPublish && (
            <Button type="button" size="sm" onClick={onPublish}>
              Publish…
            </Button>
          )}
          {canArchive && course.status === "published" && onArchive && (
            <Button type="button" size="sm" variant="outline" onClick={onArchive}>
              Archive…
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-2">
          <div>
            <dt className="inline text-slate-400">Created </dt>
            <dd className="inline">{formatDateTime(course.createdAt)}</dd>
          </div>
          <div>
            <dt className="inline text-slate-400">Updated </dt>
            <dd className="inline">{formatDateTime(course.updatedAt)}</dd>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection title="Access" defaultOpen>
        <Label htmlFor="access-type">Access policy</Label>
        <Select
          id="access-type"
          value={form.accessType}
          onChange={(e) => patchForm({ accessType: e.target.value as CourseAccessType })}
        >
          <option value="open">Open</option>
          <option value="enrollment_required">Enrollment required</option>
          <option value="paid">Paid</option>
          <option value="private">Private</option>
        </Select>
        <p className="text-xs text-slate-500">{accessHint}</p>
        <p className="text-sm text-slate-600">
          Active enrollments: <span className="font-medium">{course.enrollmentCount}</span>
        </p>
        {form.accessType === "paid" && !commerceLooksPaid && canEditCommerce && (
          <p className="text-xs text-amber-700">
            Paid access is selected, but no Stripe price ID is set yet. Configure Commerce below.
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="Progression" defaultOpen>
        <Label htmlFor="progression-type">Course progression</Label>
        <Select
          id="progression-type"
          value={form.progressionType}
          onChange={(e) =>
            patchForm({ progressionType: e.target.value as CourseProgressionType })
          }
        >
          <option value="free_form">Free form — learners may open any step</option>
          <option value="linear">Linear — complete steps in order</option>
        </Select>
        <p className="text-xs text-slate-500">
          Linear progression is stored now; player enforcement lands with the step-based student UI.
        </p>
      </SettingsSection>

      <SettingsSection title="Media" defaultOpen>
        <div className="space-y-3">
          <div>
            <Label htmlFor="thumbnail-url">Thumbnail URL</Label>
            <MediaUploader
              courseId={course.id}
              kind="thumbnail"
              className="mb-2"
              onUploaded={(url) => patchForm({ thumbnailUrl: url })}
            />
            <Input
              id="thumbnail-url"
              type="url"
              value={form.thumbnailUrl}
              onChange={(e) => patchForm({ thumbnailUrl: e.target.value })}
              placeholder="https://… or upload above"
            />
            {form.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.thumbnailUrl}
                alt="Course thumbnail preview"
                className="mt-2 h-24 w-full rounded-md object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
          <div>
            <Label htmlFor="promo-video-url">Promotional video URL</Label>
            <Input
              id="promo-video-url"
              type="url"
              value={form.promotionalVideoUrl}
              onChange={(e) => patchForm({ promotionalVideoUrl: e.target.value })}
              placeholder="https://www.youtube.com/embed/…"
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional trailer for the public course page (not lesson content). Video files stay as
              URLs (YouTube/Vimeo/S3+CloudFront).
            </p>
          </div>
        </div>
      </SettingsSection>

      {canManageInstructors ? (
        <SettingsSection title="Instructors" defaultOpen>
          <p className="text-xs text-slate-500">Select one or more instructors for this course.</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
            {instructors.length === 0 ? (
              <li className="px-1 py-2 text-sm text-slate-500">No instructors found.</li>
            ) : (
              instructors.map((inst) => {
                const label =
                  `${inst.firstName || ""} ${inst.lastName || ""}`.trim() || inst.email;
                const checked = form.instructorIds.includes(inst.id);
                return (
                  <li key={inst.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        checked={checked}
                        onChange={() => toggleInstructor(inst.id)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-800">{label}</span>
                        <span className="block truncate text-xs text-slate-400">{inst.email}</span>
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </SettingsSection>
      ) : (
        <SettingsSection title="Instructors">
          <p className="text-sm text-slate-600">
            You are assigned to this course. Contact an admin to change instructor assignments.
          </p>
        </SettingsSection>
      )}

      {canEditCommerce && (
        <SettingsSection title="Commerce" defaultOpen={false}>
          <p className="text-xs text-slate-500">
            Admin only. Stripe IDs are <span className="font-medium">not</span> autosaved — click{" "}
            <span className="font-medium">Save Stripe mapping</span> below. Use{" "}
            <span className="font-mono">price_…</span> / <span className="font-mono">prod_…</span>{" "}
            from the same Stripe mode as this app (test keys → test Dashboard).
          </p>
          <Label htmlFor="stripe-product">Stripe product ID</Label>
          <Input
            id="stripe-product"
            value={stripeProductId}
            onChange={(e) => setStripeProductId(e.target.value)}
            placeholder="prod_…"
          />
          <Label htmlFor="stripe-price">Stripe price ID</Label>
          <Input
            id="stripe-price"
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
            placeholder="price_…"
          />
          {commerceLooksPaid ? (
            <p className="text-xs text-emerald-700">Price mapping set — checkout can use this course.</p>
          ) : (
            <p className="text-xs text-slate-500">No price mapped — course is not sellable via Stripe yet.</p>
          )}
          {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={saveStripe}
            isLoading={stripeSaving}
          >
            Save Stripe mapping
          </Button>
        </SettingsSection>
      )}

      {canEditMigration && (
        <SettingsSection title="Migration" defaultOpen={false}>
          <p className="text-xs text-slate-500">Read-only LearnDash / WordPress identifiers.</p>
          {course.wordpressCourseId != null ? (
            <p className="font-mono text-xs text-slate-600">
              WordPress course ID: {course.wordpressCourseId}
            </p>
          ) : (
            <p className="text-xs text-slate-500">No WordPress course ID — created in AIGS.</p>
          )}
          <p className="font-mono text-xs text-slate-400">Course UUID: {course.id}</p>
        </SettingsSection>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          startTransition(() => {
            void persistSettings();
          });
        }}
        isLoading={isSaving}
      >
        Save settings now
      </Button>
    </div>
  );
}

function formFromCourse(course: CourseBuilderCourse): SettingsForm {
  return {
    thumbnailUrl: course.thumbnailUrl || "",
    promotionalVideoUrl: course.promotionalVideoUrl || "",
    progressionType: course.progressionType,
    accessType: course.accessType || "enrollment_required",
    instructorIds: [...course.instructorIds],
  };
}

const ACCESS_HINTS: Record<CourseAccessType, string> = {
  open: "Signed-in learners may access content without a separate enrollment record (admins still manage catalog visibility via Publish).",
  enrollment_required: "Learners need an active enrollment (manual, Stripe, or group) to open lessons.",
  paid: "Intended for Stripe checkout. Pair with a Stripe price ID under Commerce.",
  private: "Hidden from open discovery intent — only admins, assigned instructors, and enrolled learners.",
};

function SettingsSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-lg border border-slate-200 bg-white open:pb-3"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-slate-800">
        {title}
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 pt-3">{children}</div>
    </details>
  );
}

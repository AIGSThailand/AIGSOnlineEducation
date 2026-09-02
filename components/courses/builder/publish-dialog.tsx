"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogCloseButton } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPublishValidationAction, updateCourseStatusAction } from "@/features/courses/actions";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

export function PublishDialog({ open, onOpenChange, courseId }: PublishDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getPublishValidationAction(courseId).then((result) => {
        if (result.success && result.data) setErrors(result.data.errors);
      });
    }
  }, [open, courseId]);

  const handlePublish = () => {
    setSubmitError(null);
    startTransition(async () => {
      const result = await updateCourseStatusAction({ courseId, status: "published" });
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setSubmitError(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Publish course"
      description="Publishing makes this course visible in the catalog for enrollment."
      footer={
        <>
          <DialogCloseButton onClick={() => onOpenChange(false)} />
          <Button
            type="button"
            onClick={handlePublish}
            isLoading={isPending}
            disabled={errors.length > 0}
          >
            Publish
          </Button>
        </>
      }
    >
      {errors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Fix these issues before publishing:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          This course meets the minimum requirements and is ready to publish.
        </p>
      )}
      {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
    </Dialog>
  );
}

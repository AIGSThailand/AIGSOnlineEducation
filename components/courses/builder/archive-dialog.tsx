"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogCloseButton } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateCourseStatusAction } from "@/features/courses/actions";

interface ArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
}

export function ArchiveDialog({ open, onOpenChange, courseId }: ArchiveDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCourseStatusAction({ courseId, status: "archived" });
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Archive course"
      description="Archived courses are hidden from the public catalog. Enrolled students retain access."
      footer={
        <>
          <DialogCloseButton onClick={() => onOpenChange(false)} />
          <Button type="button" variant="danger" onClick={handleArchive} isLoading={isPending}>
            Archive
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        You can change the status back to draft or published later from settings.
      </p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

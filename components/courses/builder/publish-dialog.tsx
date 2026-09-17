"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogCloseButton } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPublishValidationAction, updateCourseStatusAction } from "@/features/courses/actions";
import type { PublishReport, PublishIssue } from "@/features/courses/publish-checks";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onFix?: (target: PublishIssue["target"]) => void;
  saveBlocked?: boolean;
}

export function PublishDialog({ open, onOpenChange, courseId, onFix, saveBlocked = false }: PublishDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<PublishReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkVersion, setCheckVersion] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setChecking(true); setReport(null); setSubmitError(null);
    getPublishValidationAction(courseId).then((result) => {
      if (!active) return;
      if (result.success && result.data) setReport(result.data);
      else setSubmitError(result.success ? "No checklist returned." : result.error);
    }).catch(() => { if (active) setSubmitError("Could not load the checklist. Retry the check."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [open, courseId, checkVersion]);

  const handlePublish = () => {
    if (checking || !report?.valid || saveBlocked) return;
    setSubmitError(null);
    startTransition(async () => {
      try {
      const result = await updateCourseStatusAction({ courseId, status: "published" });
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setSubmitError(result.error);
      }
      } catch { setSubmitError("Publishing failed. Your course was not confirmed published. Retry the check."); }
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
            disabled={checking || !report?.valid || saveBlocked}
          >
            Publish
          </Button>
        </>
      }
    >
      {saveBlocked && <p className="mb-3 text-sm text-amber-800">Save pending changes successfully before publishing.</p>}
      {checking ? <p role="status">Checking saved content…</p> : report && report.issues.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800">Publishing checklist</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {report.issues.map((issue, index) => (
              <li key={index} className={issue.severity === "error" ? "text-red-700" : "text-amber-800"}>
                {issue.severity === "error" ? "Required: " : "Recommended: "}{issue.message}
                {onFix && <button type="button" className="ml-2 underline" onClick={() => { onOpenChange(false); onFix(issue.target); }}>Open editor</button>}
              </li>
            ))}
          </ul>
        </div>
      ) : report ? (
        <p className="text-sm text-slate-600">
          This course meets the minimum requirements and is ready to publish.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">Checks use saved content and validate media URL format. Video playback and remote file availability still need a browser review. Publishing rechecks these requirements on the server.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" disabled={checking || isPending} onClick={() => setCheckVersion((version) => version + 1)}>Recheck</Button>
      {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
    </Dialog>
  );
}

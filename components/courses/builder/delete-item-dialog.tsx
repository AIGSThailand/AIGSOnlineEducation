"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogCloseButton } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<{ success: boolean; error?: string }>;
}

export function DeleteItemDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: DeleteItemDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result.success) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error || "Delete failed.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <DialogCloseButton onClick={() => onOpenChange(false)} />
          <Button type="button" variant="danger" onClick={handleConfirm} isLoading={isPending}>
            Remove
          </Button>
        </>
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Dialog>
  );
}

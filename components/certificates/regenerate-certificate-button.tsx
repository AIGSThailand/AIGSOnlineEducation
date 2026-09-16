"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { regenerateEarnedCertificateAction } from "@/features/certificates/actions";

export function RegenerateCertificateButton({ earnedId }: { earnedId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await regenerateEarnedCertificateAction({ earnedId });
            if (!result.success) {
              setMessage(result.error);
              return;
            }
            setMessage(result.data?.pdfUrl ? "PDF updated" : "Done (no S3 URL)");
            router.refresh();
          });
        }}
      >
        {isPending ? "…" : "Regenerate PDF"}
      </Button>
      {message && <span className="text-xs text-slate-500">{message}</span>}
    </div>
  );
}

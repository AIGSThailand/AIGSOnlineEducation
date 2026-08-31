"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Application Error]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        An unexpected error occurred while rendering this page.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()} variant="primary">
          Try Again
        </Button>
        <Button onClick={() => (window.location.href = "/")} variant="outline">
          Return Home
        </Button>
      </div>
    </div>
  );
}

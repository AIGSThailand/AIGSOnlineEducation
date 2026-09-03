"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MEDIA_KIND_LIMITS, type MediaAssetKind } from "@/features/media/types";
import { isMediaUploadAvailable, uploadCourseMedia } from "@/features/media/upload-client";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  courseId: string;
  kind: MediaAssetKind;
  onUploaded: (publicUrl: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function MediaUploader({
  courseId,
  kind,
  onUploaded,
  label,
  className,
  disabled,
}: MediaUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limits = MEDIA_KIND_LIMITS[kind];

  useEffect(() => {
    isMediaUploadAvailable().then(setConfigured);
  }, []);

  if (configured === false) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        S3 upload not configured — paste a CDN/S3 URL below. See docs/media-s3.md.
      </p>
    );
  }

  if (configured === null) {
    return <p className={cn("text-xs text-slate-400", className)}>Checking media upload…</p>;
  }

  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={limits.accept.join(",")}
        disabled={disabled || uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;

          setError(null);
          if (!limits.accept.includes(file.type)) {
            setError(`Unsupported type: ${file.type || "unknown"}`);
            return;
          }
          if (file.size > limits.maxBytes) {
            setError(
              `File too large (max ${Math.round(limits.maxBytes / (1024 * 1024))}MB).`
            );
            return;
          }

          setUploading(true);
          try {
            const { publicUrl } = await uploadCourseMedia({ courseId, kind, file });
            onUploaded(publicUrl);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.");
          } finally {
            setUploading(false);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        isLoading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        {label || `Upload ${limits.label.toLowerCase()}`}
      </Button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

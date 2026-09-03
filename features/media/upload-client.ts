/**
 * Upload a file to S3 via the presigned API.
 * Requires AWS_* env vars on the server; throws a clear error if not configured.
 */
export async function uploadCourseMedia(input: {
  courseId: string;
  kind: "thumbnail" | "lesson-image" | "promo" | "attachment";
  file: File;
}): Promise<{ publicUrl: string; key: string }> {
  const presignRes = await fetch("/api/media/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseId: input.courseId,
      kind: input.kind,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      fileSize: input.file.size,
    }),
  });

  const presignJson = (await presignRes.json()) as {
    success?: boolean;
    error?: string;
    data?: {
      uploadUrl: string;
      publicUrl: string;
      key: string;
      headers: Record<string, string>;
    };
  };

  if (!presignRes.ok || !presignJson.success || !presignJson.data) {
    throw new Error(presignJson.error || "Failed to prepare upload.");
  }

  const { uploadUrl, publicUrl, key, headers } = presignJson.data;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: input.file,
  });

  if (!putRes.ok) {
    throw new Error(`Upload to storage failed (${putRes.status}).`);
  }

  return { publicUrl, key };
}

export async function isMediaUploadAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/media/status");
    if (!res.ok) return false;
    const json = (await res.json()) as { configured?: boolean };
    return !!json.configured;
  } catch {
    return false;
  }
}

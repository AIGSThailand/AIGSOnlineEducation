/**
 * Upload a certificate template background via presigned S3 PUT.
 */
export async function uploadCertificateBackground(input: {
  templateId: string;
  file: File;
}): Promise<{ publicUrl: string; key: string }> {
  const presignRes = await fetch("/api/certificates/background/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: input.templateId,
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
    throw new Error(presignJson.error || "Failed to prepare background upload.");
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

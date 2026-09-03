import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { MediaAssetKind } from "@/features/media/types";

export type S3MediaConfig = {
  region: string;
  bucket: string;
  /** Public base URL for reads (CloudFront or public bucket URL). No trailing slash. */
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional; defaults to 300 seconds. */
  presignExpiresSeconds: number;
};

let cachedClient: S3Client | null = null;
let cachedConfig: S3MediaConfig | null = null;

/**
 * Optional media config. Returns null when AWS is not configured so the app
 * can fall back to manual URL entry.
 */
export function getS3MediaConfig(): S3MediaConfig | null {
  if (cachedConfig) return cachedConfig;

  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = (
    process.env.AWS_S3_PUBLIC_BASE_URL || process.env.AWS_CLOUDFRONT_URL || ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!region || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }

  cachedConfig = {
    region,
    bucket,
    publicBaseUrl,
    accessKeyId,
    secretAccessKey,
    presignExpiresSeconds: Number(process.env.AWS_S3_PRESIGN_EXPIRES || 300),
  };
  return cachedConfig;
}

export function isMediaUploadConfigured(): boolean {
  return getS3MediaConfig() !== null;
}

function getS3Client(config: S3MediaConfig): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function buildObjectKey(input: {
  courseId: string;
  kind: MediaAssetKind;
  fileName: string;
}): string {
  const safe = sanitizeFileName(input.fileName) || "file";
  return `courses/${input.courseId}/${input.kind}/${randomUUID()}-${safe}`;
}

export function publicUrlForKey(config: S3MediaConfig, key: string): string {
  return `${config.publicBaseUrl}/${key}`;
}

export async function createPresignedUpload(input: {
  courseId: string;
  kind: MediaAssetKind;
  fileName: string;
  contentType: string;
}): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  headers: Record<string, string>;
  expiresIn: number;
}> {
  const config = getS3MediaConfig();
  if (!config) {
    throw new Error("AWS S3 media upload is not configured.");
  }

  const key = buildObjectKey(input);
  const client = getS3Client(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: input.contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.presignExpiresSeconds,
  });

  return {
    uploadUrl,
    publicUrl: publicUrlForKey(config, key),
    key,
    headers: { "Content-Type": input.contentType },
    expiresIn: config.presignExpiresSeconds,
  };
}

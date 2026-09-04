import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import type { MediaAssetKind } from "@/features/media/types";

export type MediaAccessMode = "public" | "private";

export type S3MediaConfig = {
  region: string;
  bucket: string;
  accessMode: MediaAccessMode;
  /**
   * Public CDN/bucket base for `accessMode: "public"` reads. No trailing slash.
   * Unused for private mode (reads go through /api/media/file → signed GET).
   */
  publicBaseUrl: string | null;
  accessKeyId: string;
  secretAccessKey: string;
  /** Presigned PUT TTL (upload). Default 300. */
  presignExpiresSeconds: number;
  /** Presigned GET TTL (download). Default 60 — keep short for paid content. */
  signedGetExpiresSeconds: number;
};

export type ParsedMediaObjectKey = {
  courseId: string;
  kind: MediaAssetKind;
  fileName: string;
};

const OBJECT_KEY_RE =
  /^courses\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(thumbnail|lesson-image|promo|attachment)\/([a-z0-9._-]+)$/i;

let cachedClient: S3Client | null = null;
let cachedConfig: S3MediaConfig | null = null;

/**
 * Optional media config. Returns null when AWS is not configured so the app
 * can fall back to manual URL entry.
 *
 * Public mode needs `AWS_S3_PUBLIC_BASE_URL` or `AWS_CLOUDFRONT_URL`.
 * Private mode does not — objects stay private; the app issues short-lived GET URLs.
 */
export function getS3MediaConfig(): S3MediaConfig | null {
  if (cachedConfig) return cachedConfig;

  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const accessMode: MediaAccessMode =
    (process.env.AWS_S3_MEDIA_ACCESS || "public").trim().toLowerCase() === "private"
      ? "private"
      : "public";
  const publicBaseUrl = (
    process.env.AWS_S3_PUBLIC_BASE_URL || process.env.AWS_CLOUDFRONT_URL || ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  if (accessMode === "public" && !publicBaseUrl) {
    return null;
  }

  cachedConfig = {
    region,
    bucket,
    accessMode,
    publicBaseUrl: publicBaseUrl || null,
    accessKeyId,
    secretAccessKey,
    presignExpiresSeconds: Number(process.env.AWS_S3_PRESIGN_EXPIRES || 300),
    signedGetExpiresSeconds: Number(process.env.AWS_S3_SIGNED_GET_EXPIRES || 60),
  };
  return cachedConfig;
}

export function isMediaUploadConfigured(): boolean {
  return getS3MediaConfig() !== null;
}

export function isPrivateMediaAccess(): boolean {
  return getS3MediaConfig()?.accessMode === "private";
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

/** Stable URL stored in Postgres / TipTap HTML (never a long-lived signed URL). */
export function stableMediaUrlForKey(config: S3MediaConfig, key: string): string {
  if (config.accessMode === "private") {
    return `/api/media/file?key=${encodeURIComponent(key)}`;
  }
  if (!config.publicBaseUrl) {
    throw new Error("Public media base URL is not configured.");
  }
  return `${config.publicBaseUrl}/${key}`;
}

export function publicUrlForKey(config: S3MediaConfig, key: string): string {
  return stableMediaUrlForKey(config, key);
}

/**
 * Parse and validate an object key produced by this app.
 * Rejects path traversal and keys outside the courses/ prefix.
 */
export function parseMediaObjectKey(key: string): ParsedMediaObjectKey | null {
  const normalized = key.trim().replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || normalized.includes("\\")) {
    return null;
  }
  const match = OBJECT_KEY_RE.exec(normalized);
  if (!match) return null;
  return {
    courseId: match[1],
    kind: match[2] as MediaAssetKind,
    fileName: match[3],
  };
}

export async function createPresignedUpload(input: {
  courseId: string;
  kind: MediaAssetKind;
  fileName: string;
  contentType: string;
}): Promise<{
  uploadUrl: string;
  /** Stable URL to persist in DB (CDN or /api/media/file). */
  publicUrl: string;
  key: string;
  access: MediaAccessMode;
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
    publicUrl: stableMediaUrlForKey(config, key),
    key,
    access: config.accessMode,
    headers: { "Content-Type": input.contentType },
    expiresIn: config.presignExpiresSeconds,
  };
}

/** Short-lived S3 GetObject URL for private (or any) objects. */
export async function createPresignedDownload(key: string): Promise<{
  downloadUrl: string;
  expiresIn: number;
  key: string;
}> {
  const config = getS3MediaConfig();
  if (!config) {
    throw new Error("AWS S3 media is not configured.");
  }

  const parsed = parseMediaObjectKey(key);
  if (!parsed) {
    throw new Error("Invalid media object key.");
  }

  const client = getS3Client(config);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  const expiresIn = config.signedGetExpiresSeconds;
  const downloadUrl = await getSignedUrl(client, command, { expiresIn });

  return { downloadUrl, expiresIn, key };
}

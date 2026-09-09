/**
 * Phase 2 planning helpers: filter inventory assets for S3 upload jobs.
 */

import { proposeObjectKey } from "./media-inventory-extract";
import type { MediaAssetKind } from "../../features/media/types";

export type InventoryAssetLike = {
  normalizedUrl: string;
  sampleUrl: string;
  category: string;
  kindGuess: MediaAssetKind;
  host: string | null;
  pathname: string | null;
  fileName: string | null;
  courseIds: string[];
};

export type UploadJob = {
  sampleUrl: string;
  normalizedUrl: string;
  courseId: string;
  kind: MediaAssetKind;
  key: string;
  skippedReason?: never;
};

export type SkippedAsset = {
  sampleUrl: string;
  normalizedUrl: string;
  reason: "resized_has_full" | "no_course_id" | "wrong_host" | "wrong_category";
  mapsToFull?: string;
};

const WP_RESIZE_RE = /-\d+x\d+(\.(jpe?g|png|gif|webp))$/i;

export function isWordPressResizedFileName(fileName: string | null | undefined): boolean {
  return !!fileName && WP_RESIZE_RE.test(fileName);
}

/** If `foo-300x200.png` → `…/foo.png` normalized path (same host/dir). */
export function fullSizeNormalizedUrl(normalizedUrl: string, fileName: string | null): string | null {
  if (!fileName || !WP_RESIZE_RE.test(fileName)) return null;
  const fullName = fileName.replace(WP_RESIZE_RE, "$1");
  const slash = normalizedUrl.lastIndexOf("/");
  if (slash < 0) return null;
  return `${normalizedUrl.slice(0, slash + 1)}${fullName}`;
}

export function buildUploadJobs(input: {
  assets: InventoryAssetLike[];
  host: string;
  skipResizedWhenFullExists?: boolean;
}): { jobs: UploadJob[]; skipped: SkippedAsset[] } {
  const skipResized = input.skipResizedWhenFullExists !== false;
  const host = input.host.toLowerCase();
  const candidates = input.assets.filter(
    (a) => a.category === "migrate_candidate" && (a.host || "").toLowerCase() === host
  );

  const normalizedSet = new Set(candidates.map((a) => a.normalizedUrl));
  const jobs: UploadJob[] = [];
  const skipped: SkippedAsset[] = [];

  for (const asset of candidates) {
    if (skipResized && isWordPressResizedFileName(asset.fileName)) {
      const full = fullSizeNormalizedUrl(asset.normalizedUrl, asset.fileName);
      if (full && normalizedSet.has(full)) {
        skipped.push({
          sampleUrl: asset.sampleUrl,
          normalizedUrl: asset.normalizedUrl,
          reason: "resized_has_full",
          mapsToFull: full,
        });
        continue;
      }
    }

    if (!asset.courseIds.length) {
      skipped.push({
        sampleUrl: asset.sampleUrl,
        normalizedUrl: asset.normalizedUrl,
        reason: "no_course_id",
      });
      continue;
    }

    for (const courseId of asset.courseIds) {
      jobs.push({
        sampleUrl: asset.sampleUrl,
        normalizedUrl: asset.normalizedUrl,
        courseId,
        kind: asset.kindGuess,
        key: proposeObjectKey({
          courseId,
          kind: asset.kindGuess,
          rawUrl: asset.sampleUrl,
        }),
      });
    }
  }

  jobs.sort((a, b) =>
    a.normalizedUrl === b.normalizedUrl
      ? a.courseId.localeCompare(b.courseId)
      : a.normalizedUrl.localeCompare(b.normalizedUrl)
  );

  return { jobs, skipped };
}

export function contentTypeForUrl(url: string): string {
  const lower = url.toLowerCase().split("?")[0] || "";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".vtt")) return "text/vtt";
  if (lower.endsWith(".srt")) return "application/x-subrip";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  return "application/octet-stream";
}

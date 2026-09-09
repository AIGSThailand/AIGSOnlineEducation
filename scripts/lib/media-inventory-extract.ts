/**
 * Pure helpers: pull candidate media URLs from HTML, TipTap JSON, and plain fields.
 * Phase 1 inventory only — no network / S3 / DB writes.
 */

import { createHash } from "crypto";
import type { MediaAssetKind } from "../../features/media/types";

export type MediaCategory =
  | "migrate_candidate"
  | "already_private"
  | "already_our_key"
  | "embed_skip"
  | "data_skip"
  | "non_media";

export type MediaReference = {
  table: string;
  rowId: string;
  courseId: string | null;
  field: string;
  context: string;
};

export type ExtractedHit = {
  rawUrl: string;
  category: MediaCategory;
  kindGuess: MediaAssetKind;
  reference: MediaReference;
};

const MEDIA_EXT_RE =
  /\.(jpe?g|png|gif|webp|svg|avif|mp4|webm|mov|m4v|avi|mkv|pdf|zip|mp3|wav|ogg|vtt|srt)(?:$|[?#])/i;

const EMBED_HOST_RE =
  /(^|\.)((youtube\.com)|(youtu\.be)|(vimeo\.com)|(player\.vimeo\.com))$/i;

const ATTR_URL_RE =
  /(?:src|href|poster|data-src)\s*=\s*(["'])(.*?)\1/gi;

const SRCSET_RE = /srcset\s*=\s*(["'])(.*?)\1/gi;

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function guessKindFromField(
  table: string,
  field: string,
  url: string
): MediaAssetKind {
  const f = `${table}.${field}`.toLowerCase();
  if (f.includes("thumbnail") || f.includes("featured_image")) return "thumbnail";
  if (f.includes("promo")) return "promo";
  if (f.includes("resource") || f.includes("caption") || f.includes("video")) {
    return "attachment";
  }
  if (MEDIA_EXT_RE.test(url) && /\.(mp4|webm|mov|m4v|avi|mkv|pdf|zip|mp3|wav|ogg|vtt|srt)(?:$|[?#])/i.test(url)) {
    return "attachment";
  }
  if (f.includes("content") || f.includes("description") || f.includes("question")) {
    return "lesson-image";
  }
  return "lesson-image";
}

export function classifyUrl(rawUrl: string): MediaCategory {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "non_media";
  if (trimmed.startsWith("data:")) return "data_skip";
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("javascript:") || trimmed.startsWith("#")) {
    return "non_media";
  }

  if (trimmed.includes("/api/media/file")) return "already_private";

  // Object key style without host (rare in DB)
  if (/^courses\/[0-9a-f-]{36}\/(thumbnail|lesson-image|promo|attachment)\//i.test(trimmed)) {
    return "already_our_key";
  }

  let host = "";
  let pathname = trimmed;
  try {
    if (trimmed.startsWith("//")) {
      const u = new URL(`https:${trimmed}`);
      host = u.hostname;
      pathname = u.pathname;
    } else if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      host = u.hostname;
      pathname = u.pathname;
    } else if (trimmed.startsWith("/")) {
      pathname = trimmed.split(/[?#]/)[0] ?? trimmed;
    }
  } catch {
    return "non_media";
  }

  if (host && EMBED_HOST_RE.test(host)) return "embed_skip";

  const pathLower = pathname.toLowerCase();
  const looksLikeUpload =
    pathLower.includes("/wp-content/uploads/") ||
    pathLower.includes("/uploads/") ||
    MEDIA_EXT_RE.test(pathname) ||
    MEDIA_EXT_RE.test(trimmed);

  if (!looksLikeUpload) return "non_media";
  return "migrate_candidate";
}

/** Dedupe key: host + pathname (query stripped). Relative paths keep leading /. */
export function normalizeMediaUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    if (trimmed.startsWith("//")) {
      const u = new URL(`https:${trimmed}`);
      return `${u.hostname.toLowerCase()}${u.pathname}`;
    }
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      return `${u.hostname.toLowerCase()}${u.pathname}`;
    }
  } catch {
    /* fall through */
  }
  return trimmed.split(/[?#]/)[0] || trimmed;
}

export function fileNameFromUrl(rawUrl: string): string {
  try {
    const path = normalizeMediaUrl(rawUrl);
    const base = path.split("/").pop() || "file";
    return sanitizeFileName(decodeURIComponent(base)) || "file";
  } catch {
    return "file";
  }
}

export function proposeObjectKey(input: {
  courseId: string;
  kind: MediaAssetKind;
  rawUrl: string;
}): string {
  const digest = createHash("sha1")
    .update(normalizeMediaUrl(input.rawUrl))
    .digest("hex")
    .slice(0, 12);
  const name = fileNameFromUrl(input.rawUrl);
  return `courses/${input.courseId}/${input.kind}/migrated-${digest}-${name}`;
}

function pushHit(
  out: ExtractedHit[],
  rawUrl: string,
  reference: MediaReference,
  context: string
): void {
  const url = rawUrl.trim();
  if (!url) return;
  const category = classifyUrl(url);
  if (category === "non_media" || category === "data_skip") return;
  out.push({
    rawUrl: url,
    category,
    kindGuess: guessKindFromField(reference.table, reference.field, url),
    reference: { ...reference, context },
  });
}

export function extractUrlsFromHtml(
  html: string | null | undefined,
  reference: MediaReference
): ExtractedHit[] {
  if (!html) return [];
  const out: ExtractedHit[] = [];

  ATTR_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_URL_RE.exec(html)) !== null) {
    pushHit(out, m[2] || "", reference, m[0].slice(0, 40));
  }

  SRCSET_RE.lastIndex = 0;
  while ((m = SRCSET_RE.exec(html)) !== null) {
    const parts = (m[2] || "").split(",");
    for (const part of parts) {
      const url = part.trim().split(/\s+/)[0];
      if (url) pushHit(out, url, reference, "srcset");
    }
  }

  return out;
}

export function extractUrlsFromJson(
  value: unknown,
  reference: MediaReference,
  path = "root"
): ExtractedHit[] {
  const out: ExtractedHit[] = [];
  if (value == null) return out;

  if (typeof value === "string") {
    // TipTap sometimes stores HTML strings; also catch bare URLs
    if (value.includes("<") && value.includes(">")) {
      return extractUrlsFromHtml(value, { ...reference, context: path });
    }
    if (/^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("//")) {
      pushHit(out, value, reference, path);
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      out.push(...extractUrlsFromJson(item, reference, `${path}[${i}]`));
    });
    return out;
  }

  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    const type = typeof node.type === "string" ? node.type : null;
    const attrs = (node.attrs && typeof node.attrs === "object"
      ? (node.attrs as Record<string, unknown>)
      : null);

    if (attrs) {
      for (const key of ["src", "href", "poster", "url"]) {
        if (typeof attrs[key] === "string") {
          pushHit(out, attrs[key] as string, reference, `${path}.${type || "node"}.attrs.${key}`);
        }
      }
    }

    for (const [k, v] of Object.entries(node)) {
      if (k === "attrs") continue;
      out.push(...extractUrlsFromJson(v, reference, `${path}.${k}`));
    }
  }

  return out;
}

export function extractUrlsFromPlainField(
  value: string | null | undefined,
  reference: MediaReference
): ExtractedHit[] {
  if (!value?.trim()) return [];
  const out: ExtractedHit[] = [];
  pushHit(out, value.trim(), reference, "field");
  return out;
}

/**
 * Phase 3 helpers: build URL→S3 key maps and rewrite HTML / TipTap JSON.
 */

import {
  fullSizeNormalizedUrl,
  isWordPressResizedFileName,
} from "./media-migrate-plan";
import { normalizeMediaUrl } from "./media-inventory-extract";

export type ManifestResult = {
  sampleUrl: string;
  normalizedUrl: string;
  courseId: string;
  key: string;
  status: string;
  stableUrl?: string;
};

export type RewriteLookup = {
  /** courseId|normalizedUrl → stable /api/media/file URL */
  byCourseAndUrl: Map<string, string>;
  /** courseId|normalizedUrl → object key */
  keys: Map<string, string>;
  host: string;
};

function mapKey(courseId: string, normalizedUrl: string): string {
  return `${courseId}|${normalizedUrl}`;
}

export function stableUrlForKey(key: string): string {
  return `/api/media/file?key=${encodeURIComponent(key)}`;
}

export function normalizeLookupUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/[),.;]+$/g, "");
  try {
    let withProto = trimmed;
    if (trimmed.startsWith("//")) withProto = `https:${trimmed}`;
    if (/^https?:\/\//i.test(withProto)) {
      const u = new URL(withProto);
      let pathname = u.pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch {
        /* keep */
      }
      return `${u.hostname.toLowerCase()}${pathname}`;
    }
  } catch {
    /* fall through */
  }
  return normalizeMediaUrl(trimmed);
}

export function buildRewriteLookup(input: {
  host: string;
  uploaded: ManifestResult[];
}): RewriteLookup {
  const host = input.host.toLowerCase();
  const byCourseAndUrl = new Map<string, string>();
  const keys = new Map<string, string>();

  for (const row of input.uploaded) {
    if (row.status !== "uploaded") continue;
    if (!(row.normalizedUrl || "").toLowerCase().startsWith(host)) continue;
    const k = mapKey(row.courseId, row.normalizedUrl);
    const stable = row.stableUrl || stableUrlForKey(row.key);
    byCourseAndUrl.set(k, stable);
    keys.set(k, row.key);

    // Also index sampleUrl normalization (encoding variants)
    const fromSample = normalizeLookupUrl(row.sampleUrl);
    if (fromSample !== row.normalizedUrl) {
      byCourseAndUrl.set(mapKey(row.courseId, fromSample), stable);
      keys.set(mapKey(row.courseId, fromSample), row.key);
    }
  }

  return { byCourseAndUrl, keys, host };
}

export function resolveStableUrl(
  lookup: RewriteLookup,
  courseId: string,
  rawUrl: string
): string | null {
  const normalized = normalizeLookupUrl(rawUrl);
  if (!normalized.toLowerCase().includes(lookup.host)) return null;

  const direct = lookup.byCourseAndUrl.get(mapKey(courseId, normalized));
  if (direct) return direct;

  const fileName = normalized.split("/").pop() || null;
  if (isWordPressResizedFileName(fileName)) {
    const full = fullSizeNormalizedUrl(normalized, fileName);
    if (full) {
      const viaFull = lookup.byCourseAndUrl.get(mapKey(courseId, full));
      if (viaFull) return viaFull;
    }
  }

  return null;
}

const HOST_URL_RE_CACHE = new Map<string, RegExp>();

function hostUrlRegex(host: string): RegExp {
  const key = host.toLowerCase();
  let re = HOST_URL_RE_CACHE.get(key);
  if (!re) {
    const escaped = key.replace(/\./g, "\\.");
    re = new RegExp(`(?:https?:)?\\/\\/${escaped}\\/[^\\s"'<>\\\\]+`, "gi");
    HOST_URL_RE_CACHE.set(key, re);
  }
  return re;
}

export function rewriteHtmlForCourse(
  html: string | null | undefined,
  courseId: string,
  lookup: RewriteLookup
): { next: string | null; replacements: number; unresolved: string[] } {
  if (!html) return { next: null, replacements: 0, unresolved: [] };
  if (!html.toLowerCase().includes(lookup.host)) {
    return { next: html, replacements: 0, unresolved: [] };
  }

  const unresolved: string[] = [];
  let replacements = 0;
  const next = html.replace(hostUrlRegex(lookup.host), (match) => {
    const cleaned = match.replace(/[),.;]+$/g, "");
    const trailing = match.slice(cleaned.length);
    const stable = resolveStableUrl(lookup, courseId, cleaned);
    if (!stable) {
      unresolved.push(cleaned);
      return match;
    }
    replacements += 1;
    return stable + trailing;
  });

  return { next, replacements, unresolved: [...new Set(unresolved)] };
}

export function rewritePlainUrlField(
  value: string | null | undefined,
  courseId: string,
  lookup: RewriteLookup
): { next: string | null; replaced: boolean } {
  if (!value) return { next: value ?? null, replaced: false };
  if (!value.toLowerCase().includes(lookup.host)) {
    return { next: value, replaced: false };
  }
  // Whole-field URL
  const stable = resolveStableUrl(lookup, courseId, value.trim());
  if (stable) return { next: stable, replaced: true };
  // Or HTML-ish field
  const html = rewriteHtmlForCourse(value, courseId, lookup);
  return { next: html.next, replaced: html.replacements > 0 };
}

export function rewriteJsonValue(
  value: unknown,
  courseId: string,
  lookup: RewriteLookup
): { next: unknown; replacements: number } {
  let replacements = 0;

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      if (!node.toLowerCase().includes(lookup.host)) return node;
      if (node.includes("<")) {
        const html = rewriteHtmlForCourse(node, courseId, lookup);
        replacements += html.replacements;
        return html.next;
      }
      const plain = rewritePlainUrlField(node, courseId, lookup);
      if (plain.replaced) {
        replacements += 1;
        return plain.next;
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  return { next: walk(value), replacements };
}

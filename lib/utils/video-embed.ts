/**
 * Helpers for lesson / rich-content video URLs.
 * Direct media files must use <video>, not <iframe> (iframe often forces download).
 */

const VIDEO_FILE_EXT = /\.(mp4|webm|ogg|ogv|m4v|mov)(\?|#|$)/i;

export type VideoPlaybackKind = "youtube" | "vimeo" | "file" | "iframe" | "unknown";

export function classifyVideoUrl(url: string | null | undefined): VideoPlaybackKind {
  if (!url?.trim()) return "unknown";
  const u = url.trim();

  if (/youtu\.be\//i.test(u) || /youtube\.com\//i.test(u)) return "youtube";
  if (/vimeo\.com\//i.test(u) || /player\.vimeo\.com\//i.test(u)) return "vimeo";
  if (VIDEO_FILE_EXT.test(u) || /\/api\/media\/file/i.test(u)) return "file";
  // Common embed hosts / paths — keep as iframe
  if (/\/embed\//i.test(u) || /player\./i.test(u) || /cloudflarestream|bunnycdn|b-cdn\.net/i.test(u)) {
    return "iframe";
  }
  return "unknown";
}

/** Normalize watch URLs to embeddable iframe src when possible. */
export function toEmbedSrc(url: string): string | null {
  const trimmed = url.trim();

  const yt =
    trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i) ||
    trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i) ||
    trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;

  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;

  if (/youtube\.com\/embed\//i.test(trimmed) || /player\.vimeo\.com\/video\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function ensureVideoTagAttrs(attrs: string): string {
  let next = attrs;
  if (!/\bcontrols\b/i.test(next)) next += " controls";
  if (!/\bplaysinline\b/i.test(next)) next += ' playsinline';
  if (!/\bpreload\b/i.test(next)) next += ' preload="metadata"';
  // Prefer inline playback over download UX in supporting browsers
  if (!/\bcontrolslist\b/i.test(next)) next += ' controlslist="nodownload"';
  return next;
}

/**
 * Post-process lesson HTML so videos play inline instead of downloading.
 * - Ensures <video> has controls / playsinline
 * - Rewrites iframe[src] pointing at media files → <video>
 * - Rewrites bare <a href="…mp4"> links → <video>
 */
export function enhanceHtmlVideoPlayback(html: string): string {
  if (!html) return "";

  let out = html;

  out = out.replace(/<video\b([^>]*)>/gi, (_m, attrs: string) => {
    return `<video${ensureVideoTagAttrs(attrs)}>`;
  });

  out = out.replace(
    /<iframe\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
    (full, _before: string, _q: string, src: string) => {
      if (classifyVideoUrl(src) !== "file") return full;
      const safe = src.replace(/"/g, "&quot;");
      return `<div class="rich-content-video"><video controls playsinline preload="metadata" controlslist="nodownload" src="${safe}"></video></div>`;
    }
  );

  out = out.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, _b: string, _q: string, href: string, _a: string, inner: string) => {
      if (classifyVideoUrl(href) !== "file") return full;
      // Keep non-empty label links that look like "download" intentional resources
      const label = inner.replace(/<[^>]+>/g, "").trim().toLowerCase();
      if (/\bdownload\b/.test(label) && !VIDEO_FILE_EXT.test(label)) return full;
      const safe = href.replace(/"/g, "&quot;");
      return `<div class="rich-content-video"><video controls playsinline preload="metadata" controlslist="nodownload" src="${safe}"></video></div>`;
    }
  );

  return out;
}

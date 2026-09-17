import { wordpressContentToHtml } from "@/lib/utils/wordpress-content";
import { enhanceHtmlVideoPlayback } from "@/lib/utils/video-embed";

type PreviewMedia = {
  content: string | null;
  video_url: string | null;
  video_captions_url: string | null;
};
const mediaAttribute = /\s(src|poster)\s*=\s*(["'])(.*?)\2/gi;
const mediaTag = /<(img|video|source|track)\b[^>]*>/gi;

function previewHtml(content: string | null): string {
  return enhanceHtmlVideoPlayback(wordpressContentToHtml(content));
}

function mediaKey(source: string): string | null {
  const decoded = source.replace(/&amp;/gi, "&");
  if (!decoded.startsWith("/api/media/file?")) return null;
  return new URL(decoded, "https://preview.invalid").searchParams.get("key");
}

/** Extract exact playable/displayed files; links and lesson resources are excluded. */
export function previewMediaKeys(preview: PreviewMedia, allowedCourseIds: string[]): Set<string> {
  const keys = new Set<string>();
  function add(source: string | null, extensions: RegExp) {
    const key = source ? mediaKey(source) : null;
    if (key && extensions.test(key) && allowedCourseIds.some((id) => key.startsWith(`courses/${id}/`))) keys.add(key);
  }
  add(preview.video_url, /\.(mp4|webm|mov|m4v)$/i);
  add(preview.video_captions_url, /\.(vtt|srt)$/i);
  for (const tag of Array.from(previewHtml(preview.content).matchAll(mediaTag))) {
    const extensions =
      tag[1].toLowerCase() === "img"
        ? /\.(png|jpg|jpeg|gif|webp|avif)$/i
        : tag[1].toLowerCase() === "track"
          ? /\.(vtt|srt)$/i
          : /\.(mp4|webm|mov|m4v|png|jpg|jpeg|webp)$/i;
    for (const attr of Array.from(tag[0].matchAll(mediaAttribute))) add(attr[3], extensions);
  }
  return keys;
}

export function previewMediaUrl(source: string, courseId: string, lessonId: string): string {
  const key = mediaKey(source);
  if (!key) return source;
  const query = new URLSearchParams({ key, previewCourseId: courseId, previewLessonId: lessonId });
  return `/api/media/file?${query}`;
}

export function previewContentHtml(
  content: string | null,
  courseId: string,
  lessonId: string
): string {
  // Preview copy has no resource links or responsive sources that bypass media authorization.
  return previewHtml(content)
    .replace(/<\/?a\b[^>]*>/gi, "")
    .replace(/\s(?:srcset|data-src)\s*=\s*(["']).*?\1/gi, "")
    .replace(mediaTag, (tag) =>
      tag.replace(
        mediaAttribute,
        (_attribute, name: string, quote: string, source: string) =>
          ` ${name}=${quote}${previewMediaUrl(source, courseId, lessonId).replace(/&/g, "&amp;")}${quote}`
      )
    );
}

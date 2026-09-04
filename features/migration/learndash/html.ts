/** Decode common WP / LearnDash HTML entities in titles. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#038;|&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#8212;|&mdash;/gi, "—")
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

export function mapWpStatusToCourseStatus(
  status: string | undefined
): "draft" | "published" | "archived" {
  if (status === "publish" || status === "published") return "published";
  if (status === "trash" || status === "archived") return "archived";
  return "draft";
}

export function mapWpStatusToContentStatus(
  status: string | undefined
): "draft" | "published" | "archived" {
  return mapWpStatusToCourseStatus(status);
}

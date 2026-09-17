/**
 * Converts LearnDash / WordPress Gutenberg block markup to displayable HTML.
 * Strips <!-- wp:... --> comments while preserving inner HTML (p, ul, img, etc.).
 */

/** Decode common WP / LearnDash HTML entities in titles and plain text. */
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

/** Remove Gutenberg block boundary comments. */
export function stripWordPressBlockComments(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/** Strip basic XSS vectors from trusted-but-migrated HTML. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Clean WordPress content for HTML rendering. */
export function wordpressContentToHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(stripWordPressBlockComments(html));
}

/** Plain-text excerpt for cards and previews. */
export function wordpressContentToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return decodeHtmlEntities(
    stripWordPressBlockComments(html)
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

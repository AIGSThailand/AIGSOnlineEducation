/** Shared WordPress content helpers for migration scripts (.mjs). */

export function stripWordPressBlockComments(html) {
  if (!html) return '';
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function wordpressContentToHtml(html) {
  if (!html) return '';
  return stripWordPressBlockComments(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

export function wordpressContentToPlainText(html) {
  if (!html) return '';
  return stripWordPressBlockComments(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

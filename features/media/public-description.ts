/** Only actual image sources in public marketing copy can expose a protected image. */
export function descriptionReferencesImage(html: string | null, key: string): boolean {
  for (const match of Array.from((html || "").matchAll(/<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi))) {
    const source = match[1].replace(/&amp;/gi, "&");
    // Only the same-origin media endpoint; external URLs must not grant access.
    if (!source.startsWith("/api/media/file?")) continue;
    const url = new URL(source, "https://catalog.invalid");
    if (url.searchParams.get("key") === key) return true;
  }
  return false;
}

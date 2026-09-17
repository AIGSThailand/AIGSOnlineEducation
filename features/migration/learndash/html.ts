/** Decode common WP / LearnDash HTML entities in titles. */
export { decodeHtmlEntities } from "@/lib/utils/wordpress-content";

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

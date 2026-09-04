import { getRenderedText } from "@/lib/learndash/types/common";
import { slugifyTitle } from "@/features/courses/builder/ordering";
import { decodeHtmlEntities, mapWpStatusToCourseStatus } from "./html";
import type { LearnDashCourseInspection } from "./types";
import type { ProposedCourse } from "./proposed-types";

export function transformLearnDashCourse(inspection: LearnDashCourseInspection): ProposedCourse {
  const rawTitle = getRenderedText(inspection.course.title);
  const title = decodeHtmlEntities(rawTitle) || `Course ${inspection.courseId}`;
  const slug =
    (inspection.course.slug || "").trim() ||
    `${slugifyTitle(title) || "course"}-${inspection.courseId}`;

  const descriptionHtml = getRenderedText(inspection.course.content) || null;
  const excerpt = getRenderedText(inspection.course.excerpt) || null;

  return {
    title,
    slug,
    descriptionHtml,
    excerpt,
    status: mapWpStatusToCourseStatus(inspection.course.status),
    wordpressCourseId: inspection.courseId,
    sourceUrl: inspection.course.link || null,
  };
}

/** Prefer course.certificate_title when set; otherwise course.title. */
export function resolveCertificateCourseTitle(course?: {
  title?: string | null;
  certificate_title?: string | null;
  certificateTitle?: string | null;
} | null): string {
  const custom =
    course?.certificate_title?.trim() ||
    course?.certificateTitle?.trim() ||
    "";
  if (custom) return custom;
  return course?.title?.trim() || "Course";
}

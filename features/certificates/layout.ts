import type { CertificateTemplateData, CertificateLayoutFont } from "./types";

/** Bundled landscape blank used when a template has no custom background. */
export const DEFAULT_CERTIFICATE_BACKGROUND_URL = "/certificates/aigs-online-template.jpg";

export const DEFAULT_CERTIFICATE_LAYOUT = {
  nameFontSize: 50,
  nameYPercent: 40,
  nameFont: "trirong" as CertificateLayoutFont,
  showCourseTitle: true,
  courseFontSize: 40,
  courseYPercent: 56,
  courseFont: "helvetica" as CertificateLayoutFont,
  dateFontSize: 21,
  dateYPercent: 68,
  dateFont: "helvetica" as CertificateLayoutFont,
  showVerification: true,
  verificationYPercent: 88,
};

export function resolveCertificateBackgroundUrl(
  data?: CertificateTemplateData | null
): string {
  const custom = data?.backgroundImageUrl?.trim();
  return custom || DEFAULT_CERTIFICATE_BACKGROUND_URL;
}

export function mergeCertificateLayout(
  data?: CertificateTemplateData | null
): typeof DEFAULT_CERTIFICATE_LAYOUT & CertificateTemplateData {
  return {
    ...DEFAULT_CERTIFICATE_LAYOUT,
    ...data,
    nameFontSize: data?.nameFontSize ?? DEFAULT_CERTIFICATE_LAYOUT.nameFontSize,
    nameYPercent: data?.nameYPercent ?? DEFAULT_CERTIFICATE_LAYOUT.nameYPercent,
    nameFont: data?.nameFont ?? DEFAULT_CERTIFICATE_LAYOUT.nameFont,
    showCourseTitle:
      data?.showCourseTitle ?? DEFAULT_CERTIFICATE_LAYOUT.showCourseTitle,
    courseFontSize: data?.courseFontSize ?? DEFAULT_CERTIFICATE_LAYOUT.courseFontSize,
    courseYPercent: data?.courseYPercent ?? DEFAULT_CERTIFICATE_LAYOUT.courseYPercent,
    courseFont: data?.courseFont ?? DEFAULT_CERTIFICATE_LAYOUT.courseFont,
    dateFontSize: data?.dateFontSize ?? DEFAULT_CERTIFICATE_LAYOUT.dateFontSize,
    dateYPercent: data?.dateYPercent ?? DEFAULT_CERTIFICATE_LAYOUT.dateYPercent,
    dateFont: data?.dateFont ?? DEFAULT_CERTIFICATE_LAYOUT.dateFont,
    showVerification:
      data?.showVerification ?? DEFAULT_CERTIFICATE_LAYOUT.showVerification,
    verificationYPercent:
      data?.verificationYPercent ?? DEFAULT_CERTIFICATE_LAYOUT.verificationYPercent,
  };
}

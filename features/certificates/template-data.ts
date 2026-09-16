import type { Json } from "@/types/database.types";
import type { CertificateLayoutFont, CertificateTemplateData } from "./types";
import { DEFAULT_CERTIFICATE_LAYOUT } from "./layout";

export function asTemplateData(value: Json | null | undefined): CertificateTemplateData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CERTIFICATE_LAYOUT };
  }
  const obj = value as Record<string, unknown>;
  const asNumber = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const asFont = (v: unknown): CertificateLayoutFont | undefined =>
    v === "trirong" || v === "helvetica" ? v : undefined;

  const backgroundImageUrl =
    typeof obj.backgroundImageUrl === "string" && obj.backgroundImageUrl.trim()
      ? obj.backgroundImageUrl.trim()
      : undefined;

  return {
    headline: typeof obj.headline === "string" ? obj.headline : undefined,
    footer: typeof obj.footer === "string" ? obj.footer : undefined,
    backgroundImageUrl,
    nameFontSize: asNumber(obj.nameFontSize),
    nameYPercent: asNumber(obj.nameYPercent),
    nameFont: asFont(obj.nameFont),
    showCourseTitle:
      typeof obj.showCourseTitle === "boolean" ? obj.showCourseTitle : undefined,
    courseFontSize: asNumber(obj.courseFontSize),
    courseYPercent: asNumber(obj.courseYPercent),
    courseFont: asFont(obj.courseFont),
    dateFontSize: asNumber(obj.dateFontSize),
    dateYPercent: asNumber(obj.dateYPercent),
    dateFont: asFont(obj.dateFont),
    showVerification:
      typeof obj.showVerification === "boolean" ? obj.showVerification : undefined,
    verificationYPercent: asNumber(obj.verificationYPercent),
  };
}

export function parseTemplateDataJson(data: CertificateTemplateData): Json {
  const layout = {
    ...DEFAULT_CERTIFICATE_LAYOUT,
    ...data,
  };
  return {
    headline: data.headline || "",
    footer: data.footer || "",
    backgroundImageUrl: data.backgroundImageUrl?.trim() || "",
    nameFontSize: layout.nameFontSize,
    nameYPercent: layout.nameYPercent,
    nameFont: layout.nameFont,
    showCourseTitle: layout.showCourseTitle,
    courseFontSize: layout.courseFontSize,
    courseYPercent: layout.courseYPercent,
    courseFont: layout.courseFont,
    dateFontSize: layout.dateFontSize,
    dateYPercent: layout.dateYPercent,
    dateFont: layout.dateFont,
    showVerification: layout.showVerification,
    verificationYPercent: layout.verificationYPercent,
  };
}

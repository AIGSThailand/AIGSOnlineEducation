import type { Json } from "@/types/database.types";

export type CertificateLayoutFont = "trirong" | "helvetica";

export type CertificateTemplateData = {
  headline?: string;
  footer?: string;
  /** Custom JPG/PNG/WebP URL; omit to use the default AIGS landscape blank. */
  backgroundImageUrl?: string;
  nameFontSize?: number;
  nameYPercent?: number;
  nameFont?: CertificateLayoutFont;
  /** When false, skip course-title overlay (background already has the title). */
  showCourseTitle?: boolean;
  courseFontSize?: number;
  courseYPercent?: number;
  courseFont?: CertificateLayoutFont;
  dateFontSize?: number;
  dateYPercent?: number;
  dateFont?: CertificateLayoutFont;
  showVerification?: boolean;
  verificationYPercent?: number;
};

export type CertificateTemplateListItem = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  templateData: CertificateTemplateData;
  createdAt: string;
  updatedAt: string;
  ruleCount: number;
};

export type CertificateTemplateDetail = CertificateTemplateListItem & {
  rules: CertificateRuleItem[];
};

export type CertificateRuleItem = {
  id: string;
  certificateTemplateId: string;
  sourceType: "course";
  courseId: string;
  courseTitle: string | null;
  createdAt: string;
};

export type EarnedCertificateListItem = {
  id: string;
  certificateTemplateId: string;
  templateTitle: string;
  templateData: CertificateTemplateData;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  courseId: string | null;
  courseTitle: string | null;
  earnedAt: string;
  verificationCode: string;
  pdfUrl: string | null;
  metadata: Json;
};

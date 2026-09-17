"use client";

import { useRef } from "react";
import { Trirong } from "next/font/google";
import { formatCertificateDate } from "@/features/certificates/format";
import {
  CERTIFICATE_CONTENT_INSET_PERCENT,
  CERTIFICATE_OVERLAY_LINE_HEIGHT,
  mergeCertificateLayout,
  resolveCertificateBackgroundUrl,
} from "@/features/certificates/layout";
import { containsCjk } from "@/features/certificates/text-runs";
import type { CertificateTemplateData } from "@/features/certificates/types";
import { useCertificateCanvasScale } from "./use-certificate-canvas-scale";

const trirong = Trirong({
  subsets: ["latin", "latin-ext", "thai"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const HELVETICA = '"Helvetica Neue", Helvetica, Arial, sans-serif';
/** Browser stack: system CJK fonts handle Chinese; Helvetica for Latin. */
const CJK_STACK =
  '"PingFang SC", "Microsoft YaHei", "Heiti SC", "Noto Sans SC", "Helvetica Neue", Helvetica, Arial, sans-serif';

function fieldClass(font: "trirong" | "helvetica", text: string): string {
  if (containsCjk(text)) return "";
  return font === "trirong" ? trirong.className : "";
}

function fieldFamily(font: "trirong" | "helvetica", text: string): string | undefined {
  if (containsCjk(text)) return CJK_STACK;
  return font === "helvetica" ? HELVETICA : undefined;
}

export function CertificatePreview({
  studentName,
  courseTitle,
  earnedAt,
  verificationCode,
  templateData,
}: {
  studentName: string;
  courseTitle: string;
  earnedAt: string;
  verificationCode: string;
  templateData?: CertificateTemplateData | null;
}) {
  const canvasRef = useRef<HTMLElement>(null);
  const scale = useCertificateCanvasScale(canvasRef);
  const layout = mergeCertificateLayout(templateData);
  const completedDate = formatCertificateDate(earnedAt);
  const backgroundUrl = resolveCertificateBackgroundUrl(templateData);
  const inset = `${CERTIFICATE_CONTENT_INSET_PERCENT}%`;

  return (
    <article
      ref={canvasRef}
      className="certificate-print relative mx-auto aspect-[1.414/1] w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm print:border-0 print:shadow-none"
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0">
        <p
          className={`absolute text-center text-slate-900 ${fieldClass(
            layout.nameFont,
            studentName
          )}`}
          style={{
            left: inset,
            right: inset,
            top: `${layout.nameYPercent}%`,
            fontSize: layout.nameFontSize * scale,
            lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
            fontFamily: fieldFamily(layout.nameFont, studentName),
          }}
        >
          {studentName}
        </p>
        {layout.showCourseTitle && (
          <p
            className={`absolute text-center text-slate-900 ${fieldClass(
              layout.courseFont,
              courseTitle
            )}`}
            style={{
              left: inset,
              right: inset,
              top: `${layout.courseYPercent}%`,
              fontSize: layout.courseFontSize * scale,
              lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
              fontFamily: fieldFamily(layout.courseFont, courseTitle),
            }}
          >
            {courseTitle}
          </p>
        )}
        <p
          className={`absolute text-center text-slate-900 ${fieldClass(
            layout.dateFont,
            completedDate
          )}`}
          style={{
            left: inset,
            right: inset,
            top: `${layout.dateYPercent}%`,
            fontSize: layout.dateFontSize * scale,
            lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
            fontFamily: fieldFamily(layout.dateFont, completedDate),
          }}
        >
          {completedDate}
        </p>
        {layout.showVerification && (
          <p
            className="absolute text-center font-mono text-slate-500"
            style={{
              left: inset,
              right: inset,
              top: `${layout.verificationYPercent}%`,
              fontSize: 8 * scale,
              lineHeight: CERTIFICATE_OVERLAY_LINE_HEIGHT,
            }}
          >
            Verification: {verificationCode}
          </p>
        )}
      </div>
    </article>
  );
}

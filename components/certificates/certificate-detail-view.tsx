"use client";

import { CertificatePreview } from "@/components/certificates/certificate-preview";
import type { CertificateTemplateData } from "@/features/certificates/types";

/**
 * Prefer the generated PDF (pixel-identical to download). Fall back to HTML
 * overlay preview when no PDF is stored yet (S3 missing / not regenerated).
 */
export function CertificateDetailView({
  pdfUrl,
  studentName,
  courseTitle,
  earnedAt,
  verificationCode,
  templateData,
}: {
  pdfUrl: string | null;
  studentName: string;
  courseTitle: string;
  earnedAt: string;
  verificationCode: string;
  templateData?: CertificateTemplateData | null;
}) {
  if (pdfUrl) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm">
        <iframe
          title="Certificate PDF"
          src={`${pdfUrl}#toolbar=1&navpanes=0&view=FitH`}
          className="aspect-[1.414/1] w-full bg-white"
        />
        <p className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          Showing the generated PDF.{" "}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 hover:underline"
          >
            Open in a new tab
          </a>{" "}
          if it does not appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-amber-700">
        PDF not available yet — showing layout preview. Generate or regenerate the PDF to view the
        final file.
      </p>
      <CertificatePreview
        studentName={studentName}
        courseTitle={courseTitle}
        earnedAt={earnedAt}
        verificationCode={verificationCode}
        templateData={templateData}
      />
    </div>
  );
}

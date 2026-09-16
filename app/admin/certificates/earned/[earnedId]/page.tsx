import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/courses/permissions";
import { getEarnedCertificateById } from "@/features/certificates/queries";
import { CertificatePreview } from "@/components/certificates/certificate-preview";
import { RegenerateCertificateButton } from "@/components/certificates/regenerate-certificate-button";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: { earnedId: string };
}

export default async function AdminEarnedCertificatePage({ params }: PageProps) {
  await requireAdmin();
  const item = await getEarnedCertificateById(params.earnedId);
  if (!item) notFound();

  const studentName = item.studentName || item.studentEmail || "Student";
  const courseTitle = item.courseTitle || item.templateTitle;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/certificates" className="text-sm text-slate-500 hover:text-brand-700">
            ← Certificates
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {item.templateTitle}
          </h1>
          <p className="text-sm text-slate-500">
            {studentName}
            {item.studentEmail ? ` · ${item.studentEmail}` : ""} · {courseTitle} ·{" "}
            {new Date(item.earnedAt).toLocaleDateString()}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">{item.verificationCode}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.pdfUrl && (
            <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Download PDF
              </Button>
            </a>
          )}
          <Link href={`/verify/${item.verificationCode}`}>
            <Button variant="outline" size="sm">
              Public verify
            </Button>
          </Link>
          <RegenerateCertificateButton earnedId={item.id} />
        </div>
      </div>

      <CertificatePreview
        studentName={studentName}
        courseTitle={courseTitle}
        earnedAt={item.earnedAt}
        verificationCode={item.verificationCode}
        templateData={item.templateData}
      />
    </div>
  );
}

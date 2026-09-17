import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/permissions";
import { getEarnedCertificateById } from "@/features/certificates/queries";
import { CertificateDetailView } from "@/components/certificates/certificate-detail-view";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: { earnedId: string };
}

export default async function StudentCertificateDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const item = await getEarnedCertificateById(params.earnedId);
  if (!item || item.studentId !== user.id) notFound();

  const fromProfile = [user.profile?.first_name, user.profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const studentName = fromProfile || item.studentName || user.email;
  const courseTitle = item.courseTitle || item.templateTitle;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/student/certificates" className="text-sm text-slate-500 hover:text-brand-700">
          ← Certificates
        </Link>
        <div className="flex flex-wrap gap-2">
          {item.pdfUrl && (
            <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Download PDF
              </Button>
            </a>
          )}
          <Link href={`/verify/${item.verificationCode}`}>
            <Button variant="outline" size="sm">
              Public verify link
            </Button>
          </Link>
        </div>
      </div>

      <CertificateDetailView
        pdfUrl={item.pdfUrl}
        studentName={studentName}
        courseTitle={courseTitle}
        earnedAt={item.earnedAt}
        verificationCode={item.verificationCode}
        templateData={item.templateData}
      />
    </div>
  );
}

import Link from "next/link";
import { getEarnedCertificateByVerificationCode } from "@/features/certificates/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  params: { code: string };
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const code = decodeURIComponent(params.code || "").trim();
  const item = code ? await getEarnedCertificateByVerificationCode(code) : null;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          AIGS Online Education
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Certificate verification
        </h1>
      </div>

      {!item ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-rose-700">Not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              No certificate matches code{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{code || "—"}</code>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-emerald-700">Valid credential</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Recipient</div>
              <div className="font-medium text-slate-900">
                {item.studentName || item.studentEmail || "Student"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Award</div>
              <div className="font-medium text-slate-900">{item.templateTitle}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Course</div>
              <div className="font-medium text-slate-900">{item.courseTitle || "—"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Earned</div>
              <div>
                {new Date(item.earnedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-slate-400">Code</div>
              <code className="font-mono text-xs">{item.verificationCode}</code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

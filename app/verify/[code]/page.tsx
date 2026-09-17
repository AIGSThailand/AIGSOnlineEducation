import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react";
import { getEarnedCertificateByVerificationCode } from "@/features/certificates/queries";
import { formatCertificateDate } from "@/features/certificates/format";
import { CertificateDetailView } from "@/components/certificates/certificate-detail-view";
import { BrandLogo } from "@/components/public/brand-logo";

interface PageProps {
  params: { code: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const code = decodeURIComponent(params.code || "").trim();
  const item = code ? await getEarnedCertificateByVerificationCode(code) : null;
  if (!item) {
    return {
      title: "Certificate verification | AIGS",
      description: "Verify an AIGS Online Education certificate.",
      robots: { index: false, follow: false },
    };
  }
  const recipient = item.studentName || "a learner";
  return {
    title: `Verified: ${item.templateTitle} | AIGS`,
    description: `Certificate for ${recipient} — ${item.courseTitle || item.templateTitle}.`,
  };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] py-4 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        {label}
      </dt>
      <dd className="mt-1.5 text-base text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const code = decodeURIComponent(params.code || "").trim();
  const item = code ? await getEarnedCertificateByVerificationCode(code) : null;
  const earnedLabel = item ? formatCertificateDate(item.earnedAt) : "";
  const recipient = item
    ? item.studentName || item.studentEmail || "Student"
    : null;

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--aigs-100)_0%,_transparent_55%),linear-gradient(180deg,_var(--surface)_0%,_var(--surface-muted)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--aigs-300)] to-transparent"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <div className="mb-6 flex justify-center">
            <Link href="/" className="inline-flex opacity-90 transition-opacity hover:opacity-100">
              <BrandLogo />
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-primary)]">
            Credential check
          </p>
          <h1 className="mt-3 font-display text-3xl tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Certificate verification
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Confirm whether this certificate was issued by AIGS Online Education.
          </p>
        </header>

        {!item ? (
          <section
            className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm sm:p-8"
            aria-labelledby="verify-invalid-title"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <CircleAlert className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h2
                  id="verify-invalid-title"
                  className="font-display text-2xl text-rose-800"
                >
                  Certificate not found
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  We could not match this verification code to an issued credential. The link may be
                  incomplete, mistyped, or no longer valid.
                </p>
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                  {code || "—"}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/" className="btn-primary">
                    Back to home
                  </Link>
                  <Link
                    href="/courses"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Browse courses
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="mt-10 space-y-8">
            <section
              className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-white/95 shadow-sm backdrop-blur-sm"
              aria-labelledby="verify-valid-title"
            >
              <div className="flex flex-col gap-4 border-b border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                    <BadgeCheck className="h-7 w-7" aria-hidden />
                  </span>
                  <div>
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      Verified authentic
                    </p>
                    <h2
                      id="verify-valid-title"
                      className="mt-1 font-display text-2xl text-slate-900 sm:text-3xl"
                    >
                      {recipient}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Successfully completed{" "}
                      <span className="font-medium text-slate-800">
                        {item.courseTitle || item.templateTitle}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <Image
                    src="/brand/aigs-mark.svg"
                    alt=""
                    width={56}
                    height={56}
                    className="opacity-80"
                  />
                </div>
              </div>

              <dl className="grid gap-0 px-6 sm:grid-cols-2 sm:gap-x-10 sm:px-8 sm:py-2">
                <DetailRow label="Award">{item.templateTitle}</DetailRow>
                <DetailRow label="Course">{item.courseTitle || "—"}</DetailRow>
                <DetailRow label="Date earned">{earnedLabel || "—"}</DetailRow>
                <DetailRow label="Verification code">
                  <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm tracking-wide text-slate-800">
                    {item.verificationCode}
                  </code>
                </DetailRow>
              </dl>

              <div className="border-t border-slate-100 px-6 py-5 sm:px-8">
                <p className="text-xs leading-relaxed text-slate-500">
                  This page confirms the certificate was issued by AIGS Online Education for the
                  recipient above. For questions about authenticity, contact AIGS with the
                  verification code.
                </p>
              </div>
            </section>

            <section aria-label="Certificate document">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Certificate</h3>
              <CertificateDetailView
                pdfUrl={item.pdfUrl}
                studentName={recipient || "Student"}
                courseTitle={item.courseTitle || item.templateTitle}
                earnedAt={item.earnedAt}
                verificationCode={item.verificationCode}
                templateData={item.templateData}
              />
            </section>

            <div className="flex flex-wrap justify-center gap-3 pb-4">
              <Link href="/" className="btn-primary">
                Visit AIGS Online
              </Link>
              <Link
                href="/courses"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Explore courses
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

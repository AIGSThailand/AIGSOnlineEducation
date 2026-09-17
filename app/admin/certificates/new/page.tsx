import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { CertificateTemplateForm } from "@/components/certificates/certificate-template-form";

export default async function AdminNewCertificatePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/certificates" className="text-sm text-slate-500 hover:text-brand-700">
          ← All certificates
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">New template</h1>
        <p className="text-sm text-slate-500">
          Create a template, then attach one or more courses that award it.
        </p>
      </div>
      <CertificateTemplateForm mode={{ kind: "create" }} />
    </div>
  );
}

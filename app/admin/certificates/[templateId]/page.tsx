import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/courses/permissions";
import {
  getCertificateTemplateById,
  listPublishedCoursesForSelect,
} from "@/features/certificates/queries";
import { CertificateTemplateForm } from "@/components/certificates/certificate-template-form";
import { CertificateCourseRulesEditor } from "@/components/certificates/certificate-course-rules-editor";

interface PageProps {
  params: { templateId: string };
}

export default async function AdminEditCertificatePage({ params }: PageProps) {
  await requireAdmin();
  const [template, courses] = await Promise.all([
    getCertificateTemplateById(params.templateId),
    listPublishedCoursesForSelect(),
  ]);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/certificates" className="text-sm text-slate-500 hover:text-brand-700">
          ← All certificates
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Edit template</h1>
        <p className="text-sm text-slate-500">{template.title}</p>
      </div>
      <CertificateTemplateForm mode={{ kind: "edit", template }} />
      <CertificateCourseRulesEditor
        templateId={template.id}
        rules={template.rules}
        courses={courses}
      />
    </div>
  );
}

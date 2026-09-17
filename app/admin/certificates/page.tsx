import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import {
  listCertificateTemplates,
  listEarnedCertificatesForAdmin,
} from "@/features/certificates/queries";
import { RegenerateCertificateButton } from "@/components/certificates/regenerate-certificate-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminCertificatesPage() {
  await requireAdmin();
  const [templates, earned] = await Promise.all([
    listCertificateTemplates(),
    listEarnedCertificatesForAdmin(30),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Certificates</h1>
          <p className="text-sm text-slate-500">
            Templates, course rules, and recently earned credentials
          </p>
        </div>
        <Link href="/admin/certificates/new">
          <Button>+ New template</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Templates ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Slug</th>
                  <th className="px-6 py-3">Course rules</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No templates yet. Create one and attach a course rule.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{t.title}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{t.slug}</td>
                      <td className="px-6 py-4">
                        <Badge>{t.ruleCount}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/certificates/${t.id}`}
                          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Recently earned ({earned.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earned.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">
              No certificates issued yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {earned.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{e.templateTitle}</div>
                    <div className="text-xs text-slate-500">
                      {e.studentName || e.studentEmail} · {e.courseTitle || "Course"} ·{" "}
                      {new Date(e.earnedAt).toLocaleDateString()}
                    </div>
                    <code className="text-xs text-slate-400">{e.verificationCode}</code>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/certificates/earned/${e.id}`}
                      className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                      View
                    </Link>
                    {e.pdfUrl && (
                      <a
                        href={e.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                      >
                        PDF
                      </a>
                    )}
                    <RegenerateCertificateButton earnedId={e.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

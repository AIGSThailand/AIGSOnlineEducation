import Link from "next/link";
import { requireAuth } from "@/lib/auth/permissions";
import { listMyEarnedCertificates } from "@/features/certificates/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function StudentCertificatesPage() {
  const user = await requireAuth();
  const items = await listMyEarnedCertificates(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Certificates &amp; Credentials
        </h1>
        <p className="text-sm text-slate-500">
          Download and share verified certificates of completion
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <CardContent>
            <p className="text-sm text-slate-600">
              No certificates yet. Complete a course that awards a certificate to earn one.
            </p>
            <Link href="/student/courses" className="mt-4 inline-block">
              <Button variant="outline">My learning</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <h2 className="font-semibold text-slate-900">{item.templateTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.courseTitle || "Course"} ·{" "}
                    {new Date(item.earnedAt).toLocaleDateString()}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">{item.verificationCode}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.pdfUrl ? (
                    <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        Download PDF
                      </Button>
                    </a>
                  ) : (
                    <Badge variant="outline">PDF pending</Badge>
                  )}
                  <Link href={`/student/certificates/${item.id}`}>
                    <Button size="sm">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

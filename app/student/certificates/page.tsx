import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StudentCertificatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Certificates & Credentials
        </h1>
        <p className="text-sm text-slate-500">
          Download and share verified certificates of completion
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Digital Credentials (Phase 2 Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Automated PDF certificate generation upon 100% course completion will be enabled in
            Phase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

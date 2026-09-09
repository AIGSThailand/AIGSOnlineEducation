import Link from "next/link";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { listGroupsForAdmin } from "@/features/groups/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function AdminGroupsPage() {
  await requireCourseBuilderAccess("admin");
  const groups = await listGroupsForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Groups &amp; Bundles
          </h1>
          <p className="text-sm text-slate-500">
            Cohort access and paid multi-course bundles (LearnDash groups + Stripe)
          </p>
        </div>
        <Link href="/admin/groups/new">
          <Button>+ New group / bundle</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Groups ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Courses</th>
                  <th className="px-6 py-3">Members</th>
                  <th className="px-6 py-3">Stripe</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No groups yet. Create a bundle to attach courses and sell as one price.
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{g.name}</div>
                        <div className="text-xs text-slate-500">{g.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={g.status === "active" ? "success" : "default"}>
                          {g.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">{g.courseCount}</td>
                      <td className="px-6 py-4">{g.memberCount}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {g.stripePriceId || "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/groups/${g.id}`}
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
    </div>
  );
}

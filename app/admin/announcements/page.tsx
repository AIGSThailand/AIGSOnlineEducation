import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { listAnnouncementsForAdmin } from "@/features/announcements/queries";
import { AnnouncementStatusButtons } from "@/components/announcements/announcement-status-buttons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function statusVariant(status: string) {
  if (status === "published") return "success" as const;
  if (status === "archived") return "default" as const;
  return "default" as const;
}

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const items = await listAnnouncementsForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500">Publish platform news to students and instructors</p>
        </div>
        <Link href="/admin/announcements/new">
          <Button>+ New announcement</Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>All announcements ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Audience</th>
                  <th className="px-6 py-3">Updated</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No announcements yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{item.title}</td>
                      <td className="px-6 py-4">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </td>
                      <td className="px-6 py-4 capitalize">{item.audience}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <AnnouncementStatusButtons
                            announcementId={item.id}
                            status={item.status}
                          />
                          <Link
                            href={`/admin/announcements/${item.id}`}
                            className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                          >
                            Edit
                          </Link>
                        </div>
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

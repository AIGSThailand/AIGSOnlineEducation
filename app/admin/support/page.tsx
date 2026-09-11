import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { listSupportTicketsForAdmin } from "@/features/support/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { SupportTicketStatus } from "@/types/database.types";

interface PageProps {
  searchParams?: { status?: string };
}

const STATUSES: Array<SupportTicketStatus | "all"> = [
  "all",
  "open",
  "pending",
  "resolved",
  "closed",
];

export default async function AdminSupportPage({ searchParams }: PageProps) {
  await requireAdmin();
  const statusParam = searchParams?.status;
  const status =
    statusParam && STATUSES.includes(statusParam as SupportTicketStatus | "all")
      ? (statusParam as SupportTicketStatus | "all")
      : "all";

  const tickets = await listSupportTicketsForAdmin(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support inbox</h1>
        <p className="text-sm text-slate-500">Review and reply to student tickets</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/support" : `/admin/support?status=${s}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              status === s
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Tickets ({tickets.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Priority</th>
                  <th className="px-6 py-3">Updated</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No tickets in this view.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-semibold text-slate-900">{t.subject}</td>
                      <td className="px-6 py-4">
                        <div>{t.userName || "—"}</div>
                        <div className="text-xs text-slate-500">{t.userEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge>{t.status}</Badge>
                      </td>
                      <td className="px-6 py-4 capitalize">{t.priority}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(t.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/support/${t.id}`}
                          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Open
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

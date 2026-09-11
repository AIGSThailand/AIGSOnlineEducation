import Link from "next/link";
import { requireAuth } from "@/lib/auth/permissions";
import { listMySupportTickets } from "@/features/support/queries";
import { CreateTicketForm } from "@/components/support/create-ticket-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function StudentSupportPage() {
  const user = await requireAuth();
  const tickets = await listMySupportTickets(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Support</h1>
        <p className="text-sm text-slate-500">Open a ticket and track replies from the team</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">New ticket</h2>
        <CreateTicketForm />
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>Your tickets ({tickets.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-500">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/student/support/${t.id}`}
                    className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/80"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{t.subject}</div>
                      <div className="text-xs text-slate-400">
                        Updated {new Date(t.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={t.status === "open" ? "success" : "default"}>
                      {t.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/courses/permissions";
import { getSupportTicketDetail } from "@/features/support/queries";
import { TicketThread } from "@/components/support/ticket-thread";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: { ticketId: string };
}

export default async function AdminSupportTicketPage({ params }: PageProps) {
  await requireAdmin();
  const ticket = await getSupportTicketDetail(params.ticketId);
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/support" className="text-sm text-slate-500 hover:text-brand-700">
          ← Inbox
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{ticket.subject}</h1>
          <Badge>{ticket.status}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {ticket.userName || "User"}
          {ticket.userEmail ? ` · ${ticket.userEmail}` : ""} · Priority: {ticket.priority}
        </p>
      </div>
      <TicketThread
        ticketId={ticket.id}
        messages={ticket.messages}
        status={ticket.status}
        showStatusControls
      />
    </div>
  );
}

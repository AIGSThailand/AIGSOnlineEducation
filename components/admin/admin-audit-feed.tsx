import { formatDateTime } from "@/lib/utils";
import type { AdminAuditEvent } from "@/features/users/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function describeAudit(event: AdminAuditEvent): string {
  switch (event.action) {
    case "role_change": {
      const from = String(event.metadata.from ?? "?");
      const to = String(event.metadata.to ?? "?");
      return `changed role ${from} → ${to}`;
    }
    case "ban":
      return "banned user";
    case "unban":
      return "unbanned user";
    case "invite":
      return `invited as ${String(event.metadata.role ?? "student")}`;
    case "password_reset_sent":
      return "sent password reset";
    case "confirmation_resent":
      return "resent email confirmation";
    case "instructor_courses_set":
      return `set instructor courses (${String(event.metadata.courseCount ?? 0)})`;
    default:
      return event.action;
  }
}

export function AdminAuditFeed({ events }: { events: AdminAuditEvent[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-slate-100 p-4">
        <CardTitle>Recent admin actions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No admin audit events yet (or migration not applied). Role changes, bans, and invites
            will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {events.map((ev) => (
              <li key={ev.id} className="px-4 py-3">
                <div className="text-slate-800">
                  <span className="font-semibold">{ev.actorEmail || "Admin"}</span>{" "}
                  {describeAudit(ev)}
                  {ev.targetEmail ? (
                    <>
                      {" "}
                      for <span className="font-medium">{ev.targetEmail}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{formatDateTime(ev.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

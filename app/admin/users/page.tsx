import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          User Management
        </h1>
        <p className="text-sm text-slate-500">
          View and manage registered learners, instructors, and system administrators
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100">
          <CardTitle>Platform Accounts ({profiles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">WP User ID</th>
                  <th className="px-6 py-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles && profiles.length > 0 ? (
                  profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {p.first_name || ""} {p.last_name || ""}
                        </div>
                        <div className="text-xs text-slate-500">{p.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            p.role === "admin"
                              ? "danger"
                              : p.role === "instructor"
                              ? "warning"
                              : "default"
                          }
                        >
                          {p.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {p.wordpress_user_id ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(p.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      No user records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { requireAuth } from "@/lib/auth/permissions";
import { listActiveAnnouncements } from "@/features/announcements/queries";
import { Card, CardContent } from "@/components/ui/card";

export default async function StudentAnnouncementsPage() {
  await requireAuth();
  const items = await listActiveAnnouncements(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">News and updates from the platform</p>
      </div>

      {items.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-slate-500">No announcements right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/student/announcements/${item.id}`}>
              <Card className="transition-colors hover:border-brand-200 hover:bg-slate-50/50">
                <CardContent className="p-4">
                  <h2 className="font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

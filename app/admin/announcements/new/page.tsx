import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { AnnouncementForm } from "@/components/announcements/announcement-form";

export default async function AdminNewAnnouncementPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/announcements" className="text-sm text-slate-500 hover:text-brand-700">
          ← All announcements
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">New announcement</h1>
        <p className="text-sm text-slate-500">Draft or publish a platform-wide message.</p>
      </div>
      <AnnouncementForm mode={{ kind: "create" }} />
    </div>
  );
}

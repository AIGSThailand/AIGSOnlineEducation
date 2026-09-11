import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/courses/permissions";
import { getAnnouncementById } from "@/features/announcements/queries";
import { AnnouncementForm } from "@/components/announcements/announcement-form";

interface PageProps {
  params: { announcementId: string };
}

export default async function AdminEditAnnouncementPage({ params }: PageProps) {
  await requireAdmin();
  const item = await getAnnouncementById(params.announcementId);
  if (!item) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/announcements" className="text-sm text-slate-500 hover:text-brand-700">
          ← All announcements
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Edit announcement</h1>
        <p className="text-sm text-slate-500">{item.title}</p>
      </div>
      <AnnouncementForm mode={{ kind: "edit", announcement: item }} />
    </div>
  );
}

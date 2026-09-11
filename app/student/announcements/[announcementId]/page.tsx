import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/permissions";
import { getAnnouncementById } from "@/features/announcements/queries";
import { AnnouncementDetail } from "@/components/announcements/announcements-feed";

interface PageProps {
  params: { announcementId: string };
}

export default async function StudentAnnouncementDetailPage({ params }: PageProps) {
  await requireAuth();
  const item = await getAnnouncementById(params.announcementId);
  if (!item || item.status !== "published") notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/student/announcements" className="text-sm text-slate-500 hover:text-brand-700">
        ← All announcements
      </Link>
      <AnnouncementDetail item={item} />
    </div>
  );
}

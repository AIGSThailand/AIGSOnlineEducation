import Link from "next/link";
import { RichContent } from "@/components/courses/rich-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnnouncementListItem } from "@/features/announcements/types";

function stripPreview(html: string, max = 160): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function AnnouncementsFeed({
  items,
  listHref,
  detailBaseHref,
  title = "Announcements",
}: {
  items: AnnouncementListItem[];
  listHref: string;
  detailBaseHref: string;
  title?: string;
}) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Link href={listHref} className="text-sm font-semibold text-brand-600 hover:text-brand-500">
          View all →
        </Link>
      </CardHeader>
      <CardContent className="divide-y divide-slate-100 p-0">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`${detailBaseHref}/${item.id}`}
            className="block px-6 py-4 hover:bg-slate-50/80"
          >
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">
              {stripPreview(item.bodyHtml) || "No preview"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(item.createdAt).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export function AnnouncementDetail({ item }: { item: AnnouncementListItem }) {
  return (
    <article className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{item.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {new Date(item.createdAt).toLocaleString()}
        </p>
      </header>
      <RichContent html={item.bodyHtml} fallback="No content." />
    </article>
  );
}

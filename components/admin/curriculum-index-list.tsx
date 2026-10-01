import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminCurriculumRow } from "@/features/curriculum/admin-index";

function statusVariant(status: string) {
  if (status === "published") return "success" as const;
  if (status === "archived") return "outline" as const;
  return "default" as const;
}

export function CurriculumIndexList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: AdminCurriculumRow[];
  empty: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-[var(--border)] p-4">
        <CardTitle>
          {title} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-secondary)]">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs font-bold uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Course</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    {empty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 font-bold text-[var(--text-primary)]">{row.title}</td>
                    <td className="px-6 py-4">{row.courseTitle}</td>
                    <td className="px-6 py-4">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="px-6 py-4">{row.meta}</td>
                    <td className="px-6 py-4 text-right">
                      {row.editHref ? (
                        <Link
                          href={row.editHref}
                          className="text-sm font-bold text-[var(--brand-primary)] underline underline-offset-4"
                        >
                          Open in course
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

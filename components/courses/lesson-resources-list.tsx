import { FileText, ExternalLink, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export type LessonResourceItem = {
  id: string;
  resourceType: string;
  title: string;
  url: string | null;
  isDownloadable: boolean;
};

interface LessonResourcesListProps {
  resources: LessonResourceItem[];
  className?: string;
}

export function LessonResourcesList({ resources, className }: LessonResourcesListProps) {
  if (resources.length === 0) return null;

  return (
    <section
      className={cn("rounded-lg border border-slate-200 bg-slate-50 p-4", className)}
      aria-labelledby="lesson-resources-heading"
    >
      <h3 id="lesson-resources-heading" className="text-sm font-semibold text-slate-900">
        Resources
      </h3>
      <ul className="mt-3 divide-y divide-slate-200">
        {resources.map((r) => {
          const href = r.url?.trim() || null;
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{r.title}</p>
                  <p className="text-xs capitalize text-slate-500">{r.resourceType.replace("_", " ")}</p>
                </div>
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {r.isDownloadable ? (
                    <>
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Open
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open
                    </>
                  )}
                </a>
              ) : (
                <span className="text-xs text-slate-400">No link</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { EnrollmentProgressDetail } from "@/features/progress/staff-queries";

export function EnrollmentProgressDetailView({
  detail,
  backHref,
  backLabel,
}: {
  detail: EnrollmentProgressDetail;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-slate-500 hover:text-slate-800">
          {backLabel}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{detail.studentName}</h1>
        <p className="text-sm text-slate-500">{detail.email}</p>
      </div>

      <div className="rounded-sm border border-[var(--border)] bg-white p-4">
        <p className="font-medium text-slate-900">{detail.courseTitle}</p>
        <p className="mt-1 text-sm text-slate-600">
          {detail.total === 0
            ? "This course has no learning steps yet."
            : `${detail.completed} of ${detail.total} steps · ${detail.percent}%`}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Last activity: {detail.lastActivityAt ? formatDateTime(detail.lastActivityAt) : "No activity"}
        </p>
      </div>

      {detail.sections.length === 0 ? (
        <p className="text-sm text-slate-500">No lessons or quizzes are published in this course.</p>
      ) : (
        detail.sections.map((section) => (
          <section key={section.id} className="rounded-sm border border-[var(--border)] bg-white">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              {section.title}
            </h2>
            <ul className="divide-y divide-slate-100">
              {section.steps.map((step) => (
                <li
                  key={step.key}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${step.nested ? "pl-10" : ""}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{step.title}</p>
                    <p className="text-xs capitalize text-slate-500">{step.kind}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={step.completed ? "success" : "outline"}>
                      {step.completed ? "Done" : "Not complete"}
                    </Badge>
                    {step.completedAt ? (
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(step.completedAt)}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

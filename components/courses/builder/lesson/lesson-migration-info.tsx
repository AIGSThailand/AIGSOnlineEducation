"use client";

import { formatDate } from "@/lib/utils";

interface LessonMigrationInfoProps {
  wordpressLessonId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasSourceHtml: boolean;
}

export function LessonMigrationInfo({
  wordpressLessonId,
  createdAt,
  updatedAt,
  hasSourceHtml,
}: LessonMigrationInfoProps) {
  if (wordpressLessonId == null && !hasSourceHtml) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Migration
        </h3>
        <p className="text-sm text-slate-500">Native AIGS lesson (not imported).</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Migration
      </h3>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Source</dt>
          <dd className="font-medium text-slate-800">LearnDash</dd>
        </div>
        {wordpressLessonId != null && (
          <div>
            <dt className="text-xs text-slate-500">Source ID</dt>
            <dd className="font-mono text-slate-800">{wordpressLessonId}</dd>
          </div>
        )}
        {createdAt && (
          <div>
            <dt className="text-xs text-slate-500">Imported</dt>
            <dd className="text-slate-800">{formatDate(createdAt)}</dd>
          </div>
        )}
        {updatedAt && (
          <div>
            <dt className="text-xs text-slate-500">Last updated</dt>
            <dd className="text-slate-800">{formatDate(updatedAt)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-slate-500">Source HTML</dt>
          <dd className="text-slate-800">
            {hasSourceHtml ? "Preserved (read-only)" : "Not stored"}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-slate-400">
        Migration fields are read-only. Original imported HTML is never overwritten by the editor.
      </p>
    </section>
  );
}

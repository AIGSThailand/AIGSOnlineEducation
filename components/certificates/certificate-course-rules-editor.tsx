"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  attachCourseRuleAction,
  detachCertificateRuleAction,
} from "@/features/certificates/actions";
import type { CertificateRuleItem } from "@/features/certificates/types";

export function CertificateCourseRulesEditor({
  templateId,
  rules,
  courses,
}: {
  templateId: string;
  rules: CertificateRuleItem[];
  courses: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [courseId, setCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const attached = new Set(rules.map((r) => r.courseId));
  const available = courses.filter((c) => !attached.has(c.id));

  function onAttach(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!courseId) {
      setError("Select a course.");
      return;
    }
    startTransition(async () => {
      const result = await attachCourseRuleAction({ templateId, courseId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCourseId("");
      router.refresh();
    });
  }

  function onDetach(ruleId: string) {
    startTransition(async () => {
      const result = await detachCertificateRuleAction({ ruleId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Course rules</h2>
        <p className="text-sm text-slate-500">
          Students earn this certificate when they complete every step in an attached course.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-slate-500">No courses attached yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">
                {rule.courseTitle || rule.courseId}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => onDetach(rule.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onAttach} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="rule-course">Attach course</Label>
          <Select
            id="rule-course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={available.length === 0}
          >
            <option value="">Select course…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={isPending || available.length === 0}>
          Attach
        </Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

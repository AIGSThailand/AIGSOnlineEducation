"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  clearAccessExpirationAction,
  extendAccessAction,
  listCourseEnrollmentsForExtendAction,
} from "@/features/enrollments/actions";
import type { CourseEnrollmentAccessRow } from "@/features/enrollments/types";
import { formatDateTime } from "@/lib/utils";

function enrollmentLabel(row: CourseEnrollmentAccessRow): string {
  const name = `${row.firstName || ""} ${row.lastName || ""}`.trim();
  return name || row.email;
}

interface ExtendAccessPanelProps {
  courseId: string;
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultExtendDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return toDatetimeLocalValue(d.toISOString());
}

export function ExtendAccessPanel({ courseId }: ExtendAccessPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<CourseEnrollmentAccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableSelected, setAvailableSelected] = useState<string[]>([]);
  const [affectedIds, setAffectedIds] = useState<string[]>([]);
  const [affectedSelected, setAffectedSelected] = useState<string[]>([]);
  const [expiresLocal, setExpiresLocal] = useState(defaultExtendDatetime);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterAvailable, setFilterAvailable] = useState("");
  const [filterAffected, setFilterAffected] = useState("");

  const reload = () => {
    setLoading(true);
    startTransition(async () => {
      const data = await listCourseEnrollmentsForExtendAction(courseId);
      setRows(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per course
  }, [courseId]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.studentId, r])), [rows]);

  const availableRows = useMemo(() => {
    const q = filterAvailable.trim().toLowerCase();
    return rows
      .filter((r) => !affectedIds.includes(r.studentId))
      .filter((r) => {
        if (!q) return true;
        return enrollmentLabel(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      });
  }, [rows, affectedIds, filterAvailable]);

  const affectedRows = useMemo(() => {
    const q = filterAffected.trim().toLowerCase();
    return affectedIds
      .map((id) => byId.get(id))
      .filter((r): r is CourseEnrollmentAccessRow => !!r)
      .filter((r) => {
        if (!q) return true;
        return enrollmentLabel(r).toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      });
  }, [affectedIds, byId, filterAffected]);

  const moveToAffected = () => {
    setAffectedIds((prev) => Array.from(new Set([...prev, ...availableSelected])));
    setAvailableSelected([]);
  };

  const moveToAvailable = () => {
    const remove = new Set(affectedSelected);
    setAffectedIds((prev) => prev.filter((id) => !remove.has(id)));
    setAffectedSelected([]);
  };

  const applyExtend = (clear: boolean) => {
    setError(null);
    setSuccess(null);
    if (affectedIds.length === 0) {
      setError("Select at least one user who will be affected.");
      return;
    }
    if (!clear && !expiresLocal) {
      setError("Choose a new expiration date, or clear expiration.");
      return;
    }

    startTransition(async () => {
      const result = clear
        ? await clearAccessExpirationAction({ courseId, studentIds: affectedIds })
        : await extendAccessAction({
            courseId,
            studentIds: affectedIds,
            expiresAt: new Date(expiresLocal).toISOString(),
          });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(
        clear
          ? `Cleared expiration for ${result.data?.updated ?? affectedIds.length} student(s).`
          : `Extended access for ${result.data?.updated ?? affectedIds.length} student(s).`
      );
      setAffectedIds([]);
      setAffectedSelected([]);
      router.refresh();
      const data = await listCourseEnrollmentsForExtendAction(courseId);
      setRows(data);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Extend Access</h3>
        <p className="mt-1 text-xs text-slate-500">
          Set a new expiration date for selected enrolled students (LearnDash Extend Access).
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Extend Access">
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" title="Updated">
          {success}
        </Alert>
      )}

      <div>
        <Label htmlFor="extend-expires-at">New expiration date</Label>
        <Input
          id="extend-expires-at"
          type="datetime-local"
          value={expiresLocal}
          onChange={(e) => setExpiresLocal(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading enrollments…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No enrollments on this course yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">
            <Label>Course users</Label>
            <Input
              placeholder="Search…"
              value={filterAvailable}
              onChange={(e) => setFilterAvailable(e.target.value)}
              aria-label="Search course users"
            />
            <select
              multiple
              className="h-48 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              value={availableSelected}
              onChange={(e) =>
                setAvailableSelected(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              {availableRows.map((r) => (
                <option key={r.studentId} value={r.studentId}>
                  {enrollmentLabel(r)} — {r.status}
                  {r.expiresAt ? ` · exp ${formatDateTime(r.expiresAt)}` : " · no expiry"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-row items-center justify-center gap-2 sm:flex-col">
            <Button type="button" variant="outline" size="sm" onClick={moveToAffected} aria-label="Add to affected">
              →
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={moveToAvailable} aria-label="Remove from affected">
              ←
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Users who will be affected</Label>
            <Input
              placeholder="Search…"
              value={filterAffected}
              onChange={(e) => setFilterAffected(e.target.value)}
              aria-label="Search affected users"
            />
            <select
              multiple
              className="h-48 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              value={affectedSelected}
              onChange={(e) =>
                setAffectedSelected(Array.from(e.target.selectedOptions, (o) => o.value))
              }
            >
              {affectedRows.map((r) => (
                <option key={r.studentId} value={r.studentId}>
                  {enrollmentLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" isLoading={pending} onClick={() => applyExtend(false)}>
          Extend access
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          isLoading={pending}
          onClick={() => applyExtend(true)}
        >
          Clear expiration
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addGroupMemberAction,
  removeGroupMemberAction,
  searchGroupMembersAction,
} from "@/features/groups/actions";
import type { GroupMemberRow } from "@/features/groups/types";

export function GroupMembersEditor({
  groupId,
  members,
}: {
  groupId: string;
  members: GroupMemberRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; email: string; first_name: string | null; last_name: string | null; role: string }[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  function onSearch() {
    setMessage(null);
    startTransition(async () => {
      const result = await searchGroupMembersAction(query);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setResults(result.data || []);
    });
  }

  function addMember(userId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await addGroupMemberAction({ groupId, userId });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setQuery("");
      setResults([]);
      setMessage("Member added and enrolled in bundle courses.");
      router.refresh();
    });
  }

  function removeMember(userId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await removeGroupMemberAction({ groupId, userId });
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage("Member removed from group (course enrollments kept).");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Members</h3>
        <p className="text-xs text-slate-500">
          Adding a member grants enrollments for all courses in this group.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email or name…"
        />
        <Button type="button" variant="secondary" onClick={onSearch} disabled={isPending}>
          Search
        </Button>
      </div>

      {results.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-slate-100 p-2 text-sm">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-1 py-1">
              <span>
                {`${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email}
                <span className="ml-2 text-xs text-slate-500">
                  {r.email} · {r.role}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                disabled={isPending || members.some((m) => m.userId === r.id)}
                onClick={() => addMember(r.id)}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Member</th>
            <th className="py-2">Joined</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {members.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-4 text-slate-500">
                No members yet.
              </td>
            </tr>
          ) : (
            members.map((m) => (
              <tr key={m.userId}>
                <td className="py-2">
                  <div className="font-medium text-slate-900">
                    {`${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email}
                  </div>
                  <div className="text-xs text-slate-500">{m.email}</div>
                </td>
                <td className="py-2 text-xs text-slate-500">
                  {new Date(m.joinedAt).toLocaleDateString()}
                </td>
                <td className="py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => removeMember(m.userId)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </div>
  );
}

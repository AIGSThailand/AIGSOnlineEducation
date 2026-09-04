import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { ProposedMigratedUser } from "./transform-users-enrollments";

export type ProposedGroup = {
  wordpressGroupId: LearnDashEntityId;
  title: string;
  slug: string;
  status: "active" | "archived";
  descriptionHtml: string | null;
  memberWordpressIds: number[];
  leaderWordpressIds: number[];
  courseWordpressIds: number[];
};

export type ProposedGroupsBatch = {
  groups: ProposedGroup[];
  /** Deduped users needed for members/leaders (may be hydrated later). */
  memberUserIds: number[];
  summary: {
    groups: number;
    memberships: number;
    leaderships: number;
    groupCourses: number;
    uniqueMembers: number;
  };
  notes: string[];
};

export function aggregateProposedGroups(groups: ProposedGroup[]): ProposedGroupsBatch {
  const memberSet = new Set<number>();
  let memberships = 0;
  let leaderships = 0;
  let groupCourses = 0;
  const notes: string[] = [];

  for (const g of groups) {
    memberships += g.memberWordpressIds.length;
    leaderships += g.leaderWordpressIds.length;
    groupCourses += g.courseWordpressIds.length;
    for (const id of g.memberWordpressIds) memberSet.add(id);
    for (const id of g.leaderWordpressIds) memberSet.add(id);
    if (g.memberWordpressIds.length === 0) {
      notes.push(`Group ${g.wordpressGroupId} (${g.title}) has zero members.`);
    }
    if (g.courseWordpressIds.length === 0) {
      notes.push(`Group ${g.wordpressGroupId} (${g.title}) has zero courses.`);
    }
  }

  return {
    groups,
    memberUserIds: Array.from(memberSet).sort((a, b) => a - b),
    summary: {
      groups: groups.length,
      memberships,
      leaderships,
      groupCourses,
      uniqueMembers: memberSet.size,
    },
    notes,
  };
}

export function formatGroupsReport(
  batch: ProposedGroupsBatch,
  users?: ProposedMigratedUser[]
): string {
  const s = batch.summary;
  const lines = [
    "=== LearnDash groups (proposed) ===",
    `groups:              ${s.groups}`,
    `memberships:         ${s.memberships}`,
    `leaderships:         ${s.leaderships}`,
    `group↔course links:  ${s.groupCourses}`,
    `unique members:      ${s.uniqueMembers}`,
  ];
  if (users) {
    const missingEmail = users.filter((u) => !u.email).length;
    lines.push(`hydrated users:      ${users.length} (missing email: ${missingEmail})`);
  }
  lines.push(
    "",
    "Writes: groups + group_users + group_leaders + group_courses; materialize enrollments (source=group) without overwriting stripe/migration."
  );
  if (batch.notes.length) {
    lines.push("", "--- Notes ---");
    for (const n of batch.notes.slice(0, 30)) lines.push(`  • ${n}`);
  }
  return lines.join("\n");
}

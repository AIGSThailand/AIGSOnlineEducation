import {
  listLearnDashGroups,
  listLearnDashGroupUserIds,
  listLearnDashGroupLeaderIds,
  listLearnDashGroupCourseIds,
  getLearnDashGroup,
} from "@/lib/learndash/api/groups";
import { hydrateLearnDashUsers } from "@/lib/learndash/api/users";
import { mapWithConcurrency } from "@/lib/learndash/client";
import { getLearnDashConfig } from "@/lib/learndash/config";
import { getRenderedText } from "@/lib/learndash/types/common";
import { wordpressContentToHtml } from "@/lib/utils/wordpress-content";
import {
  aggregateProposedGroups,
  formatGroupsReport,
  type ProposedGroup,
  type ProposedGroupsBatch,
} from "./transform-groups";
import { transformLearnDashUser, type ProposedMigratedUser } from "./transform-users-enrollments";

export type GroupsInspection = {
  proposed: ProposedGroupsBatch;
  users: ProposedMigratedUser[];
  report: string;
};

/**
 * Phase 5: read-only LearnDash groups inspect.
 */
export async function inspectLearnDashGroups(): Promise<GroupsInspection> {
  const config = getLearnDashConfig();
  const listed = await listLearnDashGroups({ status: "publish" });

  const groups = await mapWithConcurrency(listed, Math.min(3, config.concurrency || 3), async (item) => {
    const [memberIds, leaderIds, courseIds, detail] = await Promise.all([
      listLearnDashGroupUserIds(item.id),
      listLearnDashGroupLeaderIds(item.id),
      listLearnDashGroupCourseIds(item.id),
      getLearnDashGroup(item.id).catch(() => null),
    ]);

    const descriptionRaw = detail ? getRenderedText(detail.content) : "";
    const descriptionHtml = descriptionRaw
      ? wordpressContentToHtml(descriptionRaw)
      : null;

    const proposed: ProposedGroup = {
      wordpressGroupId: item.id,
      title: item.title,
      slug: item.slug,
      status: item.status === "publish" ? "active" : "archived",
      descriptionHtml,
      memberWordpressIds: Array.from(new Set(memberIds)),
      leaderWordpressIds: Array.from(new Set(leaderIds)),
      courseWordpressIds: Array.from(new Set(courseIds)),
    };
    return proposed;
  });

  groups.sort((a, b) => a.wordpressGroupId - b.wordpressGroupId);
  const proposed = aggregateProposedGroups(groups);

  const stubs = proposed.memberUserIds.map((id) => ({ id }));
  const hydrated = await hydrateLearnDashUsers(stubs);
  const users = hydrated.users.map(transformLearnDashUser);

  return {
    proposed,
    users,
    report: formatGroupsReport(proposed, users),
  };
}

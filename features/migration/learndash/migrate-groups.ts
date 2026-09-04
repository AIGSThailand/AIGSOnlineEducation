import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertLearndashMigrationWriteAllowed } from "./env-safety";
import { inspectLearnDashGroups } from "./inspect-groups";
import type { ProposedGroupsBatch } from "./transform-groups";
import type { ProposedMigratedUser } from "./transform-users-enrollments";
import { syntheticWordpressEnrollmentId } from "./migrate-users";

export type MigrateGroupsOptions = {
  dryRun: boolean;
  allowProductionWrite: boolean;
  batchId?: string;
};

export type MigrateGroupsWriteStats = {
  groupsUpserted: number;
  membersUpserted: number;
  leadersUpserted: number;
  groupCoursesUpserted: number;
  enrollmentsInserted: number;
  enrollmentsSkippedExisting: number;
  usersCreated: number;
  usersLinkedExisting: number;
  usersSkippedNoEmail: number;
  usersFailed: number;
  skippedNoCourse: number;
  skippedNoUser: number;
  mapRows: number;
  errors: string[];
};

export type MigrateGroupsResult = {
  dryRun: boolean;
  proposed: ProposedGroupsBatch;
  report: string;
  written?: MigrateGroupsWriteStats;
};

type AdminClient = ReturnType<typeof createAdminClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromTable(admin: AdminClient, table: string): any {
  return (admin as any).from(table);
}

function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

async function upsertMapRow(
  admin: AdminClient,
  row: {
    source_type: string;
    wordpress_id: number;
    target_type: string;
    target_id: string;
    migration_batch_id?: string | null;
    source_data?: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await fromTable(admin, "wordpress_migration_map").upsert(row, {
    onConflict: "source_type,wordpress_id",
  });
  if (error) throw new Error(`wordpress_migration_map: ${error.message}`);
}

async function ensureAuthUser(
  admin: AdminClient,
  user: ProposedMigratedUser,
  stats: MigrateGroupsWriteStats,
  batchId: string | undefined
): Promise<string | null> {
  if (!user.email) {
    stats.usersSkippedNoEmail += 1;
    return null;
  }

  const byWp = await fromTable(admin, "profiles")
    .select("id, role")
    .eq("wordpress_user_id", user.wordpressUserId)
    .maybeSingle();
  if (byWp.error) throw new Error(byWp.error.message);
  if (byWp.data) {
    stats.usersLinkedExisting += 1;
    await fromTable(admin, "profiles")
      .update({
        wordpress_user_id: user.wordpressUserId,
        first_name: user.firstName,
        last_name: user.lastName,
        avatar_url: user.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", byWp.data.id);
    await upsertMapRow(admin, {
      source_type: "user",
      wordpress_id: user.wordpressUserId,
      target_type: "profile",
      target_id: byWp.data.id,
      migration_batch_id: batchId ?? null,
    });
    stats.mapRows += 1;
    return byWp.data.id as string;
  }

  const byEmail = await fromTable(admin, "profiles")
    .select("id, role")
    .eq("email", user.email)
    .maybeSingle();
  if (byEmail.error) throw new Error(byEmail.error.message);
  if (byEmail.data) {
    stats.usersLinkedExisting += 1;
    await fromTable(admin, "profiles")
      .update({
        wordpress_user_id: user.wordpressUserId,
        first_name: user.firstName,
        last_name: user.lastName,
        avatar_url: user.avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", byEmail.data.id);
    await upsertMapRow(admin, {
      source_type: "user",
      wordpress_id: user.wordpressUserId,
      target_type: "profile",
      target_id: byEmail.data.id,
      migration_batch_id: batchId ?? null,
      source_data: { linked_by: "email" },
    });
    stats.mapRows += 1;
    return byEmail.data.id as string;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    password: randomPassword(),
    user_metadata: {
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      wordpress_user_id: user.wordpressUserId,
      migration: "learndash-phase5-groups",
    },
  });

  if (error || !data.user) {
    const again = await fromTable(admin, "profiles")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (again.data) {
      stats.usersLinkedExisting += 1;
      await fromTable(admin, "profiles")
        .update({ wordpress_user_id: user.wordpressUserId })
        .eq("id", again.data.id);
      return again.data.id as string;
    }
    stats.usersFailed += 1;
    stats.errors.push(`Auth create WP#${user.wordpressUserId}: ${error?.message || "no user"}`);
    return null;
  }

  await fromTable(admin, "profiles")
    .update({
      wordpress_user_id: user.wordpressUserId,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      role: user.role,
    })
    .eq("id", data.user.id);

  await upsertMapRow(admin, {
    source_type: "user",
    wordpress_id: user.wordpressUserId,
    target_type: "profile",
    target_id: data.user.id,
    migration_batch_id: batchId ?? null,
    source_data: { created: true },
  });
  stats.usersCreated += 1;
  stats.mapRows += 1;
  return data.user.id;
}

async function materializeGroupEnrollment(
  admin: AdminClient,
  studentId: string,
  courseUuid: string,
  groupUuid: string,
  wordpressUserId: number,
  wordpressCourseId: number,
  stats: MigrateGroupsWriteStats
): Promise<void> {
  const existing = await fromTable(admin, "enrollments")
    .select("id, enrollment_source")
    .eq("student_id", studentId)
    .eq("course_id", courseUuid)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    const src = existing.data.enrollment_source as string;
    // Never overwrite stripe or migration access sources.
    if (src === "stripe" || src === "migration" || src === "group" || src === "admin") {
      stats.enrollmentsSkippedExisting += 1;
      return;
    }
    // Only rewrite weak `manual` rows to group.
    const { error } = await fromTable(admin, "enrollments")
      .update({
        enrollment_source: "group",
        source_reference: groupUuid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id);
    if (error) {
      stats.errors.push(`enrollment update: ${error.message}`);
      return;
    }
    stats.enrollmentsInserted += 1;
    return;
  }

  const wpEnrollmentId = syntheticWordpressEnrollmentId(wordpressUserId, wordpressCourseId);
  const { error } = await fromTable(admin, "enrollments").insert({
    student_id: studentId,
    course_id: courseUuid,
    status: "active",
    enrollment_source: "group",
    source_reference: groupUuid,
    wordpress_enrollment_id: wpEnrollmentId,
    enrolled_at: new Date().toISOString(),
  });
  if (error) {
    // Unique conflict on wordpress_enrollment_id or student_course — treat as skip.
    if (String(error.message).includes("duplicate") || error.code === "23505") {
      stats.enrollmentsSkippedExisting += 1;
      return;
    }
    stats.errors.push(`enrollment insert: ${error.message}`);
    return;
  }
  stats.enrollmentsInserted += 1;
}

export async function migrateLearnDashGroups(
  options: MigrateGroupsOptions
): Promise<MigrateGroupsResult> {
  assertLearndashMigrationWriteAllowed({
    dryRun: options.dryRun,
    allowProductionWrite: options.allowProductionWrite,
  });

  const inspection = await inspectLearnDashGroups();
  const result: MigrateGroupsResult = {
    dryRun: options.dryRun,
    proposed: inspection.proposed,
    report: inspection.report,
  };
  if (options.dryRun) return result;

  const admin = createAdminClient();
  const batchId = options.batchId ?? `ld-groups-${new Date().toISOString()}`;
  const stats: MigrateGroupsWriteStats = {
    groupsUpserted: 0,
    membersUpserted: 0,
    leadersUpserted: 0,
    groupCoursesUpserted: 0,
    enrollmentsInserted: 0,
    enrollmentsSkippedExisting: 0,
    usersCreated: 0,
    usersLinkedExisting: 0,
    usersSkippedNoEmail: 0,
    usersFailed: 0,
    skippedNoCourse: 0,
    skippedNoUser: 0,
    mapRows: 0,
    errors: [],
  };

  const wpUserToProfile = new Map<number, string>();
  for (const user of inspection.users) {
    try {
      const id = await ensureAuthUser(admin, user, stats, batchId);
      if (id) wpUserToProfile.set(user.wordpressUserId, id);
    } catch (err) {
      stats.usersFailed += 1;
      stats.errors.push(
        `User WP#${user.wordpressUserId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const courseCache = new Map<number, string | null>();

  for (const g of inspection.proposed.groups) {
    const { data: groupRow, error: groupErr } = await fromTable(admin, "groups")
      .upsert(
        {
          name: g.title,
          slug: g.slug,
          description: g.descriptionHtml,
          status: g.status,
          wordpress_group_id: g.wordpressGroupId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wordpress_group_id" }
      )
      .select("id")
      .single();

    if (groupErr || !groupRow) {
      stats.errors.push(`group ${g.wordpressGroupId}: ${groupErr?.message || "no id"}`);
      continue;
    }
    const groupUuid = groupRow.id as string;
    stats.groupsUpserted += 1;

    await upsertMapRow(admin, {
      source_type: "groups",
      wordpress_id: g.wordpressGroupId,
      target_type: "group",
      target_id: groupUuid,
      migration_batch_id: batchId,
    });
    stats.mapRows += 1;

    // Members
    for (const wpUserId of g.memberWordpressIds) {
      const profileId = wpUserToProfile.get(wpUserId);
      if (!profileId) {
        stats.skippedNoUser += 1;
        continue;
      }
      const { error } = await fromTable(admin, "group_users").upsert(
        {
          group_id: groupUuid,
          user_id: profileId,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "group_id,user_id" }
      );
      if (error) {
        stats.errors.push(`group_users: ${error.message}`);
        continue;
      }
      stats.membersUpserted += 1;
    }

    // Leaders
    for (const wpUserId of g.leaderWordpressIds) {
      const profileId = wpUserToProfile.get(wpUserId);
      if (!profileId) {
        stats.skippedNoUser += 1;
        continue;
      }
      const { error } = await fromTable(admin, "group_leaders").upsert(
        { group_id: groupUuid, user_id: profileId },
        { onConflict: "group_id,user_id" }
      );
      if (error) {
        stats.errors.push(`group_leaders: ${error.message}`);
        continue;
      }
      stats.leadersUpserted += 1;
    }

    // Courses + materialize enrollments
    const courseUuids: Array<{ wp: number; uuid: string }> = [];
    for (const wpCourseId of g.courseWordpressIds) {
      let courseUuid = courseCache.get(wpCourseId);
      if (courseUuid === undefined) {
        const { data, error } = await fromTable(admin, "courses")
          .select("id")
          .eq("wordpress_course_id", wpCourseId)
          .maybeSingle();
        if (error) throw new Error(error.message);
        courseUuid = data?.id ?? null;
        courseCache.set(wpCourseId, courseUuid);
      }
      if (!courseUuid) {
        stats.skippedNoCourse += 1;
        continue;
      }
      const { error } = await fromTable(admin, "group_courses").upsert(
        { group_id: groupUuid, course_id: courseUuid },
        { onConflict: "group_id,course_id" }
      );
      if (error) {
        stats.errors.push(`group_courses: ${error.message}`);
        continue;
      }
      stats.groupCoursesUpserted += 1;
      courseUuids.push({ wp: wpCourseId, uuid: courseUuid });
    }

    for (const wpUserId of g.memberWordpressIds) {
      const profileId = wpUserToProfile.get(wpUserId);
      if (!profileId) continue;
      for (const course of courseUuids) {
        try {
          await materializeGroupEnrollment(
            admin,
            profileId,
            course.uuid,
            groupUuid,
            wpUserId,
            course.wp,
            stats
          );
        } catch (err) {
          stats.errors.push(
            `materialize ${wpUserId}/${course.wp}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }
  }

  result.written = stats;
  return result;
}

export function formatMigrateGroupsWriteReport(stats: MigrateGroupsWriteStats): string {
  const lines = [
    "=== Groups write results ===",
    `groups upserted:            ${stats.groupsUpserted}`,
    `members upserted:           ${stats.membersUpserted}`,
    `leaders upserted:           ${stats.leadersUpserted}`,
    `group courses upserted:     ${stats.groupCoursesUpserted}`,
    `enrollments inserted/updated: ${stats.enrollmentsInserted}`,
    `enrollments skipped existing: ${stats.enrollmentsSkippedExisting}`,
    `users created:              ${stats.usersCreated}`,
    `users linked:               ${stats.usersLinkedExisting}`,
    `users skipped (no email):   ${stats.usersSkippedNoEmail}`,
    `users failed:               ${stats.usersFailed}`,
    `skipped no course map:      ${stats.skippedNoCourse}`,
    `skipped no user map:        ${stats.skippedNoUser}`,
    `map rows:                   ${stats.mapRows}`,
  ];
  if (stats.errors.length) {
    lines.push("", "--- Errors (sample) ---");
    for (const e of stats.errors.slice(0, 25)) lines.push(`  • ${e}`);
  }
  return lines.join("\n");
}

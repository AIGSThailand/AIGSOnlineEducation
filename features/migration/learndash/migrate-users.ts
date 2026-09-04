import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertLearndashMigrationWriteAllowed } from "./env-safety";
import { inspectLearnDashUsersEnrollments } from "./inspect-users-enrollments";
import type {
  ProposedMigratedEnrollment,
  ProposedMigratedUser,
  ProposedUsersEnrollments,
} from "./transform-users-enrollments";
import type { LearnDashEntityId } from "@/lib/learndash/types/common";

export type MigrateUsersOptions = {
  courseId?: LearnDashEntityId;
  allCourses?: boolean;
  dryRun: boolean;
  allowProductionWrite: boolean;
  batchId?: string;
};

export type MigrateUsersWriteStats = {
  usersCreated: number;
  usersLinkedExisting: number;
  usersSkippedNoEmail: number;
  usersFailed: number;
  enrollmentsUpserted: number;
  enrollmentsSkippedNoCourse: number;
  enrollmentsSkippedNoUser: number;
  enrollmentsFailed: number;
  mapRows: number;
  errors: string[];
};

export type MigrateUsersResult = {
  dryRun: boolean;
  proposed: ProposedUsersEnrollments;
  report: string;
  siteUserTotal: number | null;
  written?: MigrateUsersWriteStats;
};

type AdminClient = ReturnType<typeof createAdminClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromTable(admin: AdminClient, table: string): any {
  return (admin as any).from(table);
}

function migrationMap(admin: AdminClient) {
  return fromTable(admin, "wordpress_migration_map");
}

function randomPassword(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic BIGINT for (wpUserId, wpCourseId) — fits JS safe integer for current LD ids. */
export function syntheticWordpressEnrollmentId(wpUserId: number, wpCourseId: number): number {
  return wpUserId * 1_000_000_000 + wpCourseId;
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
  const { error } = await migrationMap(admin).upsert(row, {
    onConflict: "source_type,wordpress_id",
  });
  if (error) {
    throw new Error(`wordpress_migration_map upsert failed: ${error.message}`);
  }
}

async function findProfileByWordpressId(
  admin: AdminClient,
  wordpressUserId: number
): Promise<{ id: string; email: string; role: string } | null> {
  const { data, error } = await fromTable(admin, "profiles")
    .select("id, email, role")
    .eq("wordpress_user_id", wordpressUserId)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup by wordpress_user_id: ${error.message}`);
  return data;
}

async function findProfileByEmail(
  admin: AdminClient,
  email: string
): Promise<{ id: string; email: string; role: string; wordpress_user_id: number | null } | null> {
  const { data, error } = await fromTable(admin, "profiles")
    .select("id, email, role, wordpress_user_id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup by email: ${error.message}`);
  return data;
}

async function findCourseUuidByWordpressId(
  admin: AdminClient,
  wordpressCourseId: number
): Promise<string | null> {
  const { data, error } = await fromTable(admin, "courses")
    .select("id")
    .eq("wordpress_course_id", wordpressCourseId)
    .maybeSingle();
  if (error) throw new Error(`courses lookup: ${error.message}`);
  return data?.id ?? null;
}

async function ensureAuthUser(
  admin: AdminClient,
  user: ProposedMigratedUser,
  stats: MigrateUsersWriteStats,
  batchId: string | undefined
): Promise<string | null> {
  if (!user.email) {
    stats.usersSkippedNoEmail += 1;
    return null;
  }

  const byWp = await findProfileByWordpressId(admin, user.wordpressUserId);
  if (byWp) {
    stats.usersLinkedExisting += 1;
    await patchProfile(admin, byWp.id, user, byWp.role);
    await upsertMapRow(admin, {
      source_type: "user",
      wordpress_id: user.wordpressUserId,
      target_type: "profile",
      target_id: byWp.id,
      migration_batch_id: batchId ?? null,
      source_data: { email: user.email, role_guess: user.role },
    });
    stats.mapRows += 1;
    return byWp.id;
  }

  const byEmail = await findProfileByEmail(admin, user.email);
  if (byEmail) {
    stats.usersLinkedExisting += 1;
    await patchProfile(admin, byEmail.id, user, byEmail.role);
    await upsertMapRow(admin, {
      source_type: "user",
      wordpress_id: user.wordpressUserId,
      target_type: "profile",
      target_id: byEmail.id,
      migration_batch_id: batchId ?? null,
      source_data: { email: user.email, linked_by: "email", role_guess: user.role },
    });
    stats.mapRows += 1;
    return byEmail.id;
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
      migration: "learndash-phase4",
    },
  });

  if (error || !data.user) {
    // Idempotent: Auth may already exist from a prior partial run.
    const existing = await findProfileByEmail(admin, user.email);
    if (existing) {
      stats.usersLinkedExisting += 1;
      await patchProfile(admin, existing.id, user, existing.role);
      await upsertMapRow(admin, {
        source_type: "user",
        wordpress_id: user.wordpressUserId,
        target_type: "profile",
        target_id: existing.id,
        migration_batch_id: batchId ?? null,
        source_data: { email: user.email, linked_by: "email_after_create_error", role_guess: user.role },
      });
      stats.mapRows += 1;
      return existing.id;
    }
    stats.usersFailed += 1;
    stats.errors.push(
      `Auth create WP#${user.wordpressUserId} (${user.email}): ${error?.message || "no user"}`
    );
    return null;
  }

  const userId = data.user.id;
  // Trigger creates profile; patch wordpress_user_id + names/role.
  await patchProfile(admin, userId, user, user.role);
  await upsertMapRow(admin, {
    source_type: "user",
    wordpress_id: user.wordpressUserId,
    target_type: "profile",
    target_id: userId,
    migration_batch_id: batchId ?? null,
    source_data: { email: user.email, created: true, role_guess: user.role },
  });
  stats.usersCreated += 1;
  stats.mapRows += 1;
  return userId;
}

async function patchProfile(
  admin: AdminClient,
  profileId: string,
  user: ProposedMigratedUser,
  existingRole: string
): Promise<void> {
  // Never demote an existing admin via migration.
  let role = existingRole;
  if (existingRole !== "admin") {
    if (user.role === "admin" || user.role === "instructor") {
      role = user.role;
    }
  }

  const { error } = await fromTable(admin, "profiles")
    .update({
      wordpress_user_id: user.wordpressUserId,
      first_name: user.firstName,
      last_name: user.lastName,
      avatar_url: user.avatarUrl,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(`profiles update ${profileId}: ${error.message}`);
  }
}

async function upsertEnrollment(
  admin: AdminClient,
  enrollment: ProposedMigratedEnrollment,
  studentId: string,
  courseUuid: string,
  batchId: string | undefined,
  stats: MigrateUsersWriteStats
): Promise<void> {
  const wpEnrollmentId = syntheticWordpressEnrollmentId(
    enrollment.wordpressUserId,
    enrollment.wordpressCourseId
  );

  const { data, error } = await fromTable(admin, "enrollments")
    .upsert(
      {
        student_id: studentId,
        course_id: courseUuid,
        status: "active",
        enrollment_source: "migration",
        source_reference: batchId ?? enrollment.sourceKey,
        wordpress_enrollment_id: wpEnrollmentId,
        enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,course_id" }
    )
    .select("id")
    .single();

  if (error || !data?.id) {
    stats.enrollmentsFailed += 1;
    stats.errors.push(
      `Enrollment WP user ${enrollment.wordpressUserId} → course ${enrollment.wordpressCourseId}: ${error?.message || "no id"}`
    );
    return;
  }

  stats.enrollmentsUpserted += 1;
  await upsertMapRow(admin, {
    source_type: "enrollment",
    wordpress_id: wpEnrollmentId,
    target_type: "enrollment",
    target_id: data.id as string,
    migration_batch_id: batchId ?? null,
    source_data: {
      wordpress_user_id: enrollment.wordpressUserId,
      wordpress_course_id: enrollment.wordpressCourseId,
      source_key: enrollment.sourceKey,
    },
  });
  stats.mapRows += 1;
}

/**
 * Phase 4b: migrate **enrolled** LearnDash users only → Auth + profiles + enrollments.
 *
 * Auth strategy: create with email_confirm=true and a random unusable password
 * (students use “forgot password” / reset to sign in). Existing profiles matched by
 * wordpress_user_id or email are linked, not duplicated.
 */
export async function migrateLearnDashUsers(
  options: MigrateUsersOptions
): Promise<MigrateUsersResult> {
  assertLearndashMigrationWriteAllowed({
    dryRun: options.dryRun,
    allowProductionWrite: options.allowProductionWrite,
  });

  const inspection = await inspectLearnDashUsersEnrollments({
    courseId: options.courseId,
    allCourses: options.allCourses,
  });

  const result: MigrateUsersResult = {
    dryRun: options.dryRun,
    proposed: inspection.proposed,
    report: inspection.report,
    siteUserTotal: inspection.siteUserTotal,
  };

  if (options.dryRun) {
    return result;
  }

  const admin = createAdminClient();
  const batchId = options.batchId ?? `ld-users-${new Date().toISOString()}`;
  const stats: MigrateUsersWriteStats = {
    usersCreated: 0,
    usersLinkedExisting: 0,
    usersSkippedNoEmail: 0,
    usersFailed: 0,
    enrollmentsUpserted: 0,
    enrollmentsSkippedNoCourse: 0,
    enrollmentsSkippedNoUser: 0,
    enrollmentsFailed: 0,
    mapRows: 0,
    errors: [],
  };

  const wpUserToProfile = new Map<number, string>();

  for (const user of inspection.proposed.users) {
    try {
      const profileId = await ensureAuthUser(admin, user, stats, batchId);
      if (profileId) wpUserToProfile.set(user.wordpressUserId, profileId);
    } catch (err) {
      stats.usersFailed += 1;
      stats.errors.push(
        `User WP#${user.wordpressUserId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const courseCache = new Map<number, string | null>();

  for (const enrollment of inspection.proposed.enrollments) {
    const studentId = wpUserToProfile.get(enrollment.wordpressUserId);
    if (!studentId) {
      stats.enrollmentsSkippedNoUser += 1;
      continue;
    }

    let courseUuid = courseCache.get(enrollment.wordpressCourseId);
    if (courseUuid === undefined) {
      courseUuid = await findCourseUuidByWordpressId(admin, enrollment.wordpressCourseId);
      courseCache.set(enrollment.wordpressCourseId, courseUuid);
    }
    if (!courseUuid) {
      stats.enrollmentsSkippedNoCourse += 1;
      continue;
    }

    try {
      await upsertEnrollment(admin, enrollment, studentId, courseUuid, batchId, stats);
    } catch (err) {
      stats.enrollmentsFailed += 1;
      stats.errors.push(
        `Enrollment ${enrollment.sourceKey}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  result.written = stats;
  return result;
}

export function formatMigrateUsersWriteReport(stats: MigrateUsersWriteStats): string {
  const lines = [
    "=== Write results ===",
    `users created:              ${stats.usersCreated}`,
    `users linked (existing):    ${stats.usersLinkedExisting}`,
    `users skipped (no email):   ${stats.usersSkippedNoEmail}`,
    `users failed:               ${stats.usersFailed}`,
    `enrollments upserted:       ${stats.enrollmentsUpserted}`,
    `enrollments skipped (no course): ${stats.enrollmentsSkippedNoCourse}`,
    `enrollments skipped (no user):   ${stats.enrollmentsSkippedNoUser}`,
    `enrollments failed:         ${stats.enrollmentsFailed}`,
    `migration map rows:         ${stats.mapRows}`,
  ];
  if (stats.errors.length > 0) {
    lines.push("", "--- Errors (sample) ---");
    for (const e of stats.errors.slice(0, 25)) {
      lines.push(`  • ${e}`);
    }
    if (stats.errors.length > 25) {
      lines.push(`  … +${stats.errors.length - 25} more`);
    }
  }
  return lines.join("\n");
}

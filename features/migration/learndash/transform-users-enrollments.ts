import type { LearnDashEntityId } from "@/lib/learndash/types/common";
import type { CourseUsersFetchSource, LearnDashUser } from "@/lib/learndash/types/user";

export type ProposedAppRole = "admin" | "instructor" | "student";

export type ProposedMigratedUser = {
  wordpressUserId: LearnDashEntityId;
  email: string | null;
  username: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Suggested app role — defaults to student unless clearly admin/instructor. */
  role: ProposedAppRole;
  wordpressRoles: string[];
  avatarUrl: string | null;
};

export type ProposedMigratedEnrollment = {
  wordpressUserId: LearnDashEntityId;
  wordpressCourseId: LearnDashEntityId;
  status: "active";
  enrollmentSource: "migration";
  /** Synthetic stable key for wordpress_enrollment_id / map: `${userId}:${courseId}` hash later. */
  sourceKey: string;
};

export type CourseUsersSnapshot = {
  wordpressCourseId: LearnDashEntityId;
  courseTitle: string;
  users: LearnDashUser[];
  source: CourseUsersFetchSource;
  usedV1Fallback: boolean;
  warnings: string[];
  v2Count: number;
  v1Count: number | null;
};

export type ProposedUsersEnrollments = {
  users: ProposedMigratedUser[];
  enrollments: ProposedMigratedEnrollment[];
  summary: {
    courses: number;
    uniqueUsers: number;
    enrollments: number;
    missingEmail: number;
    duplicateEmails: number;
    coursesWithZeroUsers: number;
    v1FallbackCourses: number;
  };
  notes: string[];
  emailDuplicates: Array<{ email: string; wordpressUserIds: number[] }>;
};

const ADMIN_ROLES = new Set(["administrator", "admin"]);
const INSTRUCTOR_ROLES = new Set([
  "instructor",
  "wdm_instructor",
  "group_leader",
  "editor",
  "author",
  "lp_teacher",
]);

/**
 * Map WP roles → app role guess.
 * Per migration-mapping: default student; do not 1:1 map WP roles.
 */
export function guessAppRole(roles: string[] | undefined): ProposedAppRole {
  const normalized = (roles || []).map((r) => r.toLowerCase().trim());
  if (normalized.some((r) => ADMIN_ROLES.has(r))) return "admin";
  if (normalized.some((r) => INSTRUCTOR_ROLES.has(r))) return "instructor";
  return "student";
}

function pickAvatar(user: LearnDashUser): string | null {
  const urls = user.avatar_urls;
  if (!urls || typeof urls !== "object") return null;
  return urls["96"] || urls["48"] || urls["24"] || Object.values(urls)[0] || null;
}

function splitDisplayName(name: string | null | undefined): { first: string | null; last: string | null } {
  const trimmed = (name || "").trim();
  if (!trimmed) return { first: null, last: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function transformLearnDashUser(user: LearnDashUser): ProposedMigratedUser {
  const fromFields = {
    first: (user.first_name || "").trim() || null,
    last: (user.last_name || "").trim() || null,
  };
  const fromDisplay = splitDisplayName(user.name);
  const email = (user.email || "").trim().toLowerCase() || null;
  const wordpressRoles = Array.isArray(user.roles) ? user.roles.map(String) : [];

  return {
    wordpressUserId: Number(user.id),
    email,
    username: (user.username || user.slug || "").trim() || null,
    displayName: (user.name || "").trim() || null,
    firstName: fromFields.first || fromDisplay.first,
    lastName: fromFields.last || fromDisplay.last,
    role: guessAppRole(wordpressRoles),
    wordpressRoles,
    avatarUrl: pickAvatar(user),
  };
}

/**
 * Pure transform: course user snapshots → deduped users + enrollment proposals.
 */
export function transformUsersEnrollments(
  snapshots: CourseUsersSnapshot[]
): ProposedUsersEnrollments {
  const usersById = new Map<number, ProposedMigratedUser>();
  const enrollments: ProposedMigratedEnrollment[] = [];
  const notes: string[] = [];
  let coursesWithZeroUsers = 0;
  let v1FallbackCourses = 0;

  for (const snap of snapshots) {
    if (snap.usedV1Fallback) v1FallbackCourses += 1;
    for (const w of snap.warnings) {
      notes.push(`[course ${snap.wordpressCourseId}] ${w}`);
    }
    if (snap.users.length === 0) {
      coursesWithZeroUsers += 1;
      notes.push(
        `Course ${snap.wordpressCourseId} (${snap.courseTitle}) has zero enrolled users via ${snap.source}.`
      );
    }

    for (const raw of snap.users) {
      const proposed = transformLearnDashUser(raw);
      const existing = usersById.get(proposed.wordpressUserId);
      if (!existing) {
        usersById.set(proposed.wordpressUserId, proposed);
      } else {
        // Prefer row that has email / richer name fields.
        if (!existing.email && proposed.email) {
          usersById.set(proposed.wordpressUserId, { ...existing, email: proposed.email });
        }
        if ((!existing.firstName || !existing.lastName) && (proposed.firstName || proposed.lastName)) {
          const merged = usersById.get(proposed.wordpressUserId)!;
          usersById.set(proposed.wordpressUserId, {
            ...merged,
            firstName: merged.firstName || proposed.firstName,
            lastName: merged.lastName || proposed.lastName,
            displayName: merged.displayName || proposed.displayName,
          });
        }
        if (existing.wordpressRoles.length === 0 && proposed.wordpressRoles.length > 0) {
          const merged = usersById.get(proposed.wordpressUserId)!;
          usersById.set(proposed.wordpressUserId, {
            ...merged,
            wordpressRoles: proposed.wordpressRoles,
            role: proposed.role,
          });
        }
      }

      enrollments.push({
        wordpressUserId: proposed.wordpressUserId,
        wordpressCourseId: snap.wordpressCourseId,
        status: "active",
        enrollmentSource: "migration",
        sourceKey: `${proposed.wordpressUserId}:${snap.wordpressCourseId}`,
      });
    }
  }

  // Dedupe enrollments by sourceKey (same user listed twice on a course).
  const enrollmentByKey = new Map<string, ProposedMigratedEnrollment>();
  for (const e of enrollments) {
    enrollmentByKey.set(e.sourceKey, e);
  }
  const uniqueEnrollments = Array.from(enrollmentByKey.values());

  const users = Array.from(usersById.values()).sort(
    (a, b) => a.wordpressUserId - b.wordpressUserId
  );

  const emailToIds = new Map<string, number[]>();
  let missingEmail = 0;
  for (const u of users) {
    if (!u.email) {
      missingEmail += 1;
      continue;
    }
    const list = emailToIds.get(u.email) || [];
    list.push(u.wordpressUserId);
    emailToIds.set(u.email, list);
  }

  const emailDuplicates = Array.from(emailToIds.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([email, wordpressUserIds]) => ({ email, wordpressUserIds }))
    .sort((a, b) => b.wordpressUserIds.length - a.wordpressUserIds.length);

  if (missingEmail > 0) {
    notes.push(`${missingEmail} unique user(s) missing email — Auth create will need a strategy or skip.`);
  }
  if (emailDuplicates.length > 0) {
    notes.push(
      `${emailDuplicates.length} duplicate email(s) across WordPress users — resolve before Auth create.`
    );
  }

  const roleCounts = { admin: 0, instructor: 0, student: 0 };
  for (const u of users) roleCounts[u.role] += 1;
  notes.push(
    `Role guess: admin=${roleCounts.admin}, instructor=${roleCounts.instructor}, student=${roleCounts.student} ` +
      `(WP global roles are not 1:1; default is student).`
  );

  return {
    users,
    enrollments: uniqueEnrollments.sort(
      (a, b) =>
        a.wordpressCourseId - b.wordpressCourseId || a.wordpressUserId - b.wordpressUserId
    ),
    summary: {
      courses: snapshots.length,
      uniqueUsers: users.length,
      enrollments: uniqueEnrollments.length,
      missingEmail,
      duplicateEmails: emailDuplicates.length,
      coursesWithZeroUsers,
      v1FallbackCourses,
    },
    notes,
    emailDuplicates,
  };
}

export function formatUsersEnrollmentsReport(proposed: ProposedUsersEnrollments): string {
  const lines: string[] = [];
  const s = proposed.summary;
  lines.push("=== LearnDash users + enrollments (proposed) ===");
  lines.push(`courses:              ${s.courses}`);
  lines.push(`unique users:         ${s.uniqueUsers}`);
  lines.push(`enrollments:          ${s.enrollments}`);
  lines.push(`missing email:        ${s.missingEmail}`);
  lines.push(`duplicate emails:     ${s.duplicateEmails}`);
  lines.push(`courses with 0 users: ${s.coursesWithZeroUsers}`);
  lines.push(`v1 fallback courses:  ${s.v1FallbackCourses}`);
  lines.push("");

  if (proposed.emailDuplicates.length > 0) {
    lines.push("--- Duplicate emails (top 20) ---");
    for (const d of proposed.emailDuplicates.slice(0, 20)) {
      lines.push(`  ${d.email} → WP users ${d.wordpressUserIds.join(", ")}`);
    }
    lines.push("");
  }

  const missing = proposed.users.filter((u) => !u.email).slice(0, 20);
  if (missing.length > 0) {
    lines.push("--- Missing email (sample) ---");
    for (const u of missing) {
      lines.push(
        `  WP#${u.wordpressUserId} username=${u.username || "?"} name=${u.displayName || "?"}`
      );
    }
    lines.push("");
  }

  if (proposed.notes.length > 0) {
    lines.push("--- Notes ---");
    for (const n of proposed.notes.slice(0, 40)) {
      lines.push(`  • ${n}`);
    }
    if (proposed.notes.length > 40) {
      lines.push(`  … +${proposed.notes.length - 40} more`);
    }
  }

  lines.push("");
  lines.push(
    "Scope: enrolled users only (not full WP directory). " +
      "Writes: npm run migrate:learndash-users -- … --write"
  );
  return lines.join("\n");
}

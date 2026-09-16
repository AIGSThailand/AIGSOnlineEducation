import type { UserRole } from "@/types/database.types";

export type AdminUserListItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  wordpressUserId: number | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  instructorCourses: { id: string; title: string }[];
};

export type AdminUserListResult = {
  users: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminUserListFilters = {
  q?: string;
  role?: UserRole | "all";
  page?: number;
  pageSize?: number;
};

export type CourseOption = {
  id: string;
  title: string;
  status: string;
};

export type AdminAuditEvent = {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UserAuthActivityEvent = {
  id: string;
  createdAt: string;
  action: string;
  ipAddress: string | null;
};

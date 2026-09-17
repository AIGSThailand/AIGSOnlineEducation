import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { getCurrentUser } from "@/lib/auth/permissions";
import {
  listCoursesForInstructorAssignment,
  listUsersForAdmin,
} from "@/features/users/queries";
import { adminUserListQuerySchema } from "@/features/users/schema";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { UserAccountActions } from "@/components/admin/user-account-actions";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { InstructorCoursesEditor } from "@/components/admin/instructor-courses-editor";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { UserRole } from "@/types/database.types";

interface AdminUsersPageProps {
  searchParams: {
    q?: string;
    role?: string;
    page?: string;
  };
}

function emailStatusBadges(emailConfirmedAt: string | null, bannedUntil: string | null) {
  const banned =
    bannedUntil && new Date(bannedUntil).getTime() > Date.now() ? (
      <Badge variant="danger">Banned</Badge>
    ) : null;
  const confirmed = emailConfirmedAt ? (
    <Badge variant="success">Confirmed</Badge>
  ) : (
    <Badge variant="warning">Unconfirmed</Badge>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {confirmed}
      {banned}
    </div>
  );
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdmin();
  const current = await getCurrentUser();

  const parsed = adminUserListQuerySchema.safeParse({
    q: searchParams.q,
    role: searchParams.role || "all",
    page: searchParams.page || "1",
  });

  const filters = parsed.success
    ? parsed.data
    : { q: undefined, role: "all" as const, page: 1 };

  const [result, allCourses] = await Promise.all([
    listUsersForAdmin({
      q: filters.q,
      role: (filters.role as UserRole | "all") || "all",
      page: filters.page ?? 1,
    }),
    listCoursesForInstructorAssignment(),
  ]);

  const roleFilter = filters.role || "all";
  const qValue = filters.q || "";

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (qValue) params.set("q", qValue);
    if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users &amp; Roles</h1>
        <p className="text-sm text-slate-500">
          Invite users, manage roles, and ban accounts
        </p>
      </div>

      <InviteUserForm />

      <form className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label htmlFor="user-search">Search</Label>
          <Input
            id="user-search"
            name="q"
            defaultValue={qValue}
            placeholder="Email or name…"
          />
        </div>
        <div>
          <Label htmlFor="user-role">Role</Label>
          <Select id="user-role" name="role" defaultValue={roleFilter}>
            <option value="all">All roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Apply filters
          </Button>
        </div>
      </form>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-100 p-4">
          <CardTitle>
            Platform accounts ({result.total})
            <span className="ml-2 text-sm font-normal text-slate-500">
              Page {result.page} of {result.totalPages}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Courses</th>
                  <th className="px-4 py-3">Last sign-in</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.users.length > 0 ? (
                  result.users.map((u) => {
                    const isSelf = current?.id === u.id;
                    const isBanned = !!(
                      u.bannedUntil && new Date(u.bannedUntil).getTime() > Date.now()
                    );
                    const canAssignCourses = u.role === "instructor" || u.role === "admin";
                    return (
                      <tr key={u.id} className="align-top hover:bg-slate-50/50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">
                            {`${u.firstName || ""} ${u.lastName || ""}`.trim() || "—"}
                            {isSelf ? (
                              <span className="ml-2 text-xs font-medium text-brand-600">
                                You
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            Joined {formatDate(u.createdAt)}
                            {u.wordpressUserId != null ? ` · WP ${u.wordpressUserId}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <UserRoleSelect
                            userId={u.id}
                            email={u.email}
                            role={u.role}
                            isSelf={isSelf}
                          />
                        </td>
                        <td className="px-4 py-4">
                          {emailStatusBadges(u.emailConfirmedAt, u.bannedUntil)}
                        </td>
                        <td className="px-4 py-4">
                          {canAssignCourses ? (
                            <InstructorCoursesEditor
                              userId={u.id}
                              assigned={u.instructorCourses}
                              allCourses={allCourses}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "Never"}
                        </td>
                        <td className="px-4 py-4">
                          <UserAccountActions
                            userId={u.id}
                            emailConfirmed={!!u.emailConfirmedAt}
                            isBanned={isBanned}
                            isSelf={isSelf}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No users match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {result.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-sm">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="font-medium text-brand-600">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              {result.page < result.totalPages ? (
                <Link href={pageHref(result.page + 1)} className="font-medium text-brand-600">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

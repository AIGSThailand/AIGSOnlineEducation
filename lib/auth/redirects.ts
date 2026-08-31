import type { UserRole } from "@/types/database.types";

/**
 * Returns the default authenticated landing dashboard path for each role.
 */
export function getRoleDashboardPath(role?: UserRole | null): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "instructor":
      return "/instructor/dashboard";
    case "student":
    default:
      return "/student/dashboard";
  }
}

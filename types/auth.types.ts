import type { UserRole } from "./database.types";

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  wordpress_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  profile: UserProfile | null;
}

export type AuthActionResult =
  { success: true; message?: string; redirectUrl?: string } | { success: false; error: string };

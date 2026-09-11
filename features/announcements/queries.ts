import { createClient } from "@/lib/supabase/server";
import type { AnnouncementAudience, AnnouncementStatus } from "@/types/database.types";
import type { AnnouncementListItem } from "./types";

type Row = {
  id: string;
  title: string;
  body_html: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Row): AnnouncementListItem {
  return {
    id: row.id,
    title: row.title,
    bodyHtml: row.body_html,
    status: row.status,
    audience: row.audience,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAnnouncementsForAdmin(): Promise<AnnouncementListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function getAnnouncementById(id: string): Promise<AnnouncementListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle<Row>();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

/** Active published announcements visible to the current user (RLS filters). */
export async function listActiveAnnouncements(limit = 10): Promise<AnnouncementListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<Row[]>();

  if (error) {
    console.error("[listActiveAnnouncements]", error.message);
    return [];
  }
  return (data || []).map(mapRow);
}

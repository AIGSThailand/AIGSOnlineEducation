import type { AnnouncementAudience, AnnouncementStatus } from "@/types/database.types";

export type AnnouncementListItem = {
  id: string;
  title: string;
  bodyHtml: string;
  status: AnnouncementStatus;
  audience: AnnouncementAudience;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

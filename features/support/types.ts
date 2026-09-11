import type { SupportTicketPriority, SupportTicketStatus } from "@/types/database.types";

export type SupportTicketListItem = {
  id: string;
  userId: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  createdAt: string;
  updatedAt: string;
  userEmail?: string | null;
  userName?: string | null;
};

export type SupportMessageItem = {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
  authorName?: string | null;
};

export type SupportTicketDetail = SupportTicketListItem & {
  messages: SupportMessageItem[];
};

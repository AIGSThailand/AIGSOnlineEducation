import { createClient } from "@/lib/supabase/server";
import type { SupportTicketPriority, SupportTicketStatus } from "@/types/database.types";
import type {
  SupportMessageItem,
  SupportTicketDetail,
  SupportTicketListItem,
} from "./types";

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
};

function mapTicket(
  row: TicketRow,
  extra?: { userEmail?: string | null; userName?: string | null }
): SupportTicketListItem {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userEmail: extra?.userEmail,
    userName: extra?.userName,
  };
}

function mapMessage(
  row: MessageRow,
  authorName?: string | null
): SupportMessageItem {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    body: row.body,
    isStaff: row.is_staff,
    createdAt: row.created_at,
    authorName,
  };
}

export async function listMySupportTickets(userId: string): Promise<SupportTicketListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<TicketRow[]>();

  if (error) throw new Error(error.message);
  return (data || []).map((row) => mapTicket(row));
}

export async function listSupportTicketsForAdmin(
  status?: SupportTicketStatus | "all"
): Promise<SupportTicketListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("support_tickets")
    .select(
      `
      *,
      profile:profiles!support_tickets_user_id_fkey(email, first_name, last_name)
    `
    )
    .order("updated_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query.returns<
    (TicketRow & {
      profile:
        | { email: string | null; first_name: string | null; last_name: string | null }
        | { email: string | null; first_name: string | null; last_name: string | null }[]
        | null;
    })[]
  >();

  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;
    return mapTicket(row, { userEmail: profile?.email ?? null, userName: name });
  });
}

export async function getSupportTicketDetail(
  ticketId: string
): Promise<SupportTicketDetail | null> {
  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .select(
      `
      *,
      profile:profiles!support_tickets_user_id_fkey(email, first_name, last_name)
    `
    )
    .eq("id", ticketId)
    .maybeSingle<
      TicketRow & {
        profile:
          | { email: string | null; first_name: string | null; last_name: string | null }
          | { email: string | null; first_name: string | null; last_name: string | null }[]
          | null;
      }
    >();

  if (error) throw new Error(error.message);
  if (!ticket) return null;

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select(
      `
      *,
      author:profiles!support_messages_author_id_fkey(first_name, last_name)
    `
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
    .returns<
      (MessageRow & {
        author:
          | { first_name: string | null; last_name: string | null }
          | { first_name: string | null; last_name: string | null }[]
          | null;
      })[]
    >();

  if (msgError) throw new Error(msgError.message);

  const profile = Array.isArray(ticket.profile) ? ticket.profile[0] : ticket.profile;
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null;

  return {
    ...mapTicket(ticket, { userEmail: profile?.email ?? null, userName: name }),
    messages: (messages || []).map((m) => {
      const author = Array.isArray(m.author) ? m.author[0] : m.author;
      const authorName =
        [author?.first_name, author?.last_name].filter(Boolean).join(" ") || null;
      return mapMessage(m, authorName);
    }),
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/courses/permissions";
import { requireAuth } from "@/lib/auth/permissions";
import type { ActionResult } from "@/features/courses/types";
import { notifyNewSupportTicket } from "./notify";
import {
  createTicketSchema,
  replyTicketSchema,
  updateTicketStatusSchema,
} from "./schema";

function revalidateSupport(ticketId?: string) {
  revalidatePath("/student/support");
  revalidatePath("/admin/support");
  if (ticketId) {
    revalidatePath(`/student/support/${ticketId}`);
    revalidatePath(`/admin/support/${ticketId}`);
  }
}

export async function createSupportTicketAction(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const user = await requireAuth();
  const parsed = createTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid ticket." };
  }

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: parsed.data.subject,
      priority: parsed.data.priority || "normal",
      status: "open",
    } as never)
    .select("id")
    .single<{ id: string }>();

  if (error) return { success: false, error: error.message };

  const { error: msgError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    body: parsed.data.body,
    is_staff: false,
  } as never);

  if (msgError) return { success: false, error: msgError.message };

  await notifyNewSupportTicket({
    ticketId: ticket.id,
    subject: parsed.data.subject,
    body: parsed.data.body,
    userEmail: user.email,
  });

  revalidateSupport(ticket.id);
  return { success: true, data: { id: ticket.id } };
}

export async function replySupportTicketAction(input: unknown): Promise<ActionResult> {
  const user = await requireAuth();
  const parsed = replyTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid reply." };
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", parsed.data.ticketId)
    .maybeSingle<{ id: string; user_id: string; status: string }>();

  if (ticketError) return { success: false, error: ticketError.message };
  if (!ticket) return { success: false, error: "Ticket not found." };

  const isOwner = ticket.user_id === user.id;
  const isAdmin = user.profile?.role === "admin";
  if (!isOwner && !isAdmin) {
    return { success: false, error: "Not allowed." };
  }

  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_id: user.id,
    body: parsed.data.body,
    is_staff: isAdmin,
  } as never);

  if (error) return { success: false, error: error.message };

  const nextStatus = isAdmin
    ? ticket.status === "open"
      ? "pending"
      : ticket.status
    : "open";

  await supabase
    .from("support_tickets")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", ticket.id);

  revalidateSupport(ticket.id);
  return { success: true };
}

export async function updateSupportTicketStatusAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateTicketStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.ticketId);

  if (error) return { success: false, error: error.message };

  revalidateSupport(parsed.data.ticketId);
  return { success: true };
}

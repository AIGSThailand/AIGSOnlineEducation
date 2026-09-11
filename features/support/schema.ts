import { z } from "zod";

export const supportTicketStatusSchema = z.enum(["open", "pending", "resolved", "closed"]);
export const supportTicketPrioritySchema = z.enum(["low", "normal", "high"]);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(10000),
  priority: supportTicketPrioritySchema.optional(),
});

export const ticketIdSchema = z.object({
  ticketId: z.string().uuid(),
});

export const replyTicketSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(10000),
});

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: supportTicketStatusSchema,
});

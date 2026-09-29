import { z } from "zod";
import { EMAIL_EVENT_KEYS } from "./events";

export const saveSmtpSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(320).optional().or(z.literal("")),
  password: z.string().max(500).optional().or(z.literal("")),
  fromEmail: z.string().trim().email("Enter a valid from address."),
  fromName: z.string().trim().max(200).optional().or(z.literal("")),
});

export const saveTemplateSchema = z.object({
  eventKey: z.enum(EMAIL_EVENT_KEYS),
  subject: z.string().trim().min(1).max(200),
  htmlBody: z.string().trim().min(1).max(50000),
  textBody: z.string().trim().min(1).max(20000),
});

export const resetTemplateSchema = z.object({
  eventKey: z.enum(EMAIL_EVENT_KEYS),
});

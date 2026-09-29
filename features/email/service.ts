import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppEnv } from "@/lib/env/resolve-app-env";
import type { AppEnv } from "@/lib/env/types";
import { decryptSecret } from "./crypto";
import { EMAIL_EVENTS, type EmailEventKey, type EmailTemplateContent } from "./events";
import { renderEmailTemplate } from "./render";

type SmtpRow = {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password_ciphertext: string | null;
  from_email: string;
  from_name: string | null;
};

type LogStatus = "sent" | "failed" | "skipped";

async function writeLog(entry: {
  appEnv: AppEnv;
  eventKey: string;
  toEmail: string;
  subject: string;
  status: LogStatus;
  error?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_logs").insert({
      app_env: entry.appEnv,
      event_key: entry.eventKey,
      to_email: entry.toEmail,
      subject: entry.subject.slice(0, 500),
      status: entry.status,
      error: entry.error ? entry.error.slice(0, 1000) : null,
    } as never);
    if (error) console.error("[email] log insert failed:", error.message);
  } catch (err) {
    console.error("[email] log insert failed:", err);
  }
}

async function loadTemplate(appEnv: AppEnv, eventKey: EmailEventKey): Promise<EmailTemplateContent> {
  const defaults = EMAIL_EVENTS[eventKey].defaults;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_templates")
    .select("subject, html_body, text_body")
    .eq("app_env", appEnv)
    .eq("event_key", eventKey)
    .maybeSingle<{ subject: string; html_body: string; text_body: string }>();

  if (error || !data) return defaults;
  return {
    subject: data.subject,
    htmlBody: data.html_body,
    textBody: data.text_body,
  };
}

async function loadSmtp(appEnv: AppEnv): Promise<SmtpRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_smtp_configs")
    .select("host, port, secure, username, password_ciphertext, from_email, from_name")
    .eq("app_env", appEnv)
    .maybeSingle<SmtpRow>();
  if (error || !data) return null;
  return data;
}

/**
 * The only application mail sender.
 * Never throws. Callers (tickets, payments, courses) must keep working when SMTP fails.
 * Authentication mail stays on Supabase and does not use this function.
 */
export async function sendApplicationEmail(input: {
  eventKey: EmailEventKey;
  to: string;
  variables: Record<string, string>;
}): Promise<void> {
  const appEnv = resolveAppEnv();
  const to = input.to.trim();
  let subject = EMAIL_EVENTS[input.eventKey].defaults.subject;

  try {
    if (!to) {
      await writeLog({
        appEnv,
        eventKey: input.eventKey,
        toEmail: "(missing)",
        subject,
        status: "skipped",
        error: "No recipient.",
      });
      return;
    }

    const template = await loadTemplate(appEnv, input.eventKey);
    const rendered = renderEmailTemplate(template, input.variables);
    subject = rendered.subject || subject;

    const smtp = await loadSmtp(appEnv);
    if (!smtp) {
      await writeLog({
        appEnv,
        eventKey: input.eventKey,
        toEmail: to,
        subject,
        status: "skipped",
        error: `No SMTP configuration for ${appEnv}.`,
      });
      return;
    }

    let password: string | undefined;
    if (smtp.password_ciphertext) {
      password = decryptSecret(smtp.password_ciphertext);
    }

    const fromName = smtp.from_name?.trim();
    const from = fromName ? `"${fromName.replace(/"/g, "")}" <${smtp.from_email}>` : smtp.from_email;

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: password ?? "" } : undefined,
    });

    await transport.sendMail({
      from,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await writeLog({
      appEnv,
      eventKey: input.eventKey,
      toEmail: to,
      subject: rendered.subject,
      status: "sent",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed.";
    console.error("[email]", input.eventKey, message);
    await writeLog({
      appEnv,
      eventKey: input.eventKey,
      toEmail: to || "(missing)",
      subject,
      status: "failed",
      error: message,
    });
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppEnv } from "@/lib/env/resolve-app-env";
import type { AppEnv } from "@/lib/env/types";
import { EMAIL_EVENT_KEYS, EMAIL_EVENTS, type EmailEventKey } from "./events";

export type SmtpAdminView = {
  appEnv: AppEnv;
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  passwordConfigured: boolean;
};

export type TemplateAdminView = {
  eventKey: EmailEventKey;
  label: string;
  description: string;
  variables: { key: string; description: string }[];
  subject: string;
  htmlBody: string;
  textBody: string;
  customized: boolean;
};

export type EmailLogView = {
  id: string;
  eventKey: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export async function getEmailAdminView(): Promise<{
  smtp: SmtpAdminView;
  templates: TemplateAdminView[];
  logs: EmailLogView[];
  loadError: string | null;
}> {
  const appEnv = resolveAppEnv();
  const admin = createAdminClient();

  const [smtpResult, templateResult, logResult] = await Promise.all([
    admin
      .from("email_smtp_configs")
      .select("host, port, secure, username, from_email, from_name, password_ciphertext")
      .eq("app_env", appEnv)
      .maybeSingle<{
        host: string;
        port: number;
        secure: boolean;
        username: string | null;
        from_email: string;
        from_name: string | null;
        password_ciphertext: string | null;
      }>(),
    admin
      .from("email_templates")
      .select("event_key, subject, html_body, text_body")
      .eq("app_env", appEnv)
      .returns<
        { event_key: string; subject: string; html_body: string; text_body: string }[]
      >(),
    admin
      .from("email_logs")
      .select("id, event_key, to_email, subject, status, error, created_at")
      .eq("app_env", appEnv)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<
        {
          id: string;
          event_key: string;
          to_email: string;
          subject: string;
          status: string;
          error: string | null;
          created_at: string;
        }[]
      >(),
  ]);

  const smtpRow = smtpResult.data;
  const overrides = new Map((templateResult.data || []).map((row) => [row.event_key, row]));

  const templates: TemplateAdminView[] = EMAIL_EVENT_KEYS.map((eventKey) => {
    const definition = EMAIL_EVENTS[eventKey];
    const override = overrides.get(eventKey);
    return {
      eventKey,
      label: definition.label,
      description: definition.description,
      variables: definition.variables,
      subject: override?.subject ?? definition.defaults.subject,
      htmlBody: override?.html_body ?? definition.defaults.htmlBody,
      textBody: override?.text_body ?? definition.defaults.textBody,
      customized: Boolean(override),
    };
  });

  const loadError =
    smtpResult.error?.message || templateResult.error?.message || logResult.error?.message || null;

  return {
    loadError,
    smtp: {
      appEnv,
      configured: Boolean(smtpRow),
      host: smtpRow?.host ?? "",
      port: smtpRow?.port ?? 587,
      secure: smtpRow?.secure ?? false,
      username: smtpRow?.username ?? "",
      fromEmail: smtpRow?.from_email ?? "",
      fromName: smtpRow?.from_name ?? "",
      passwordConfigured: Boolean(smtpRow?.password_ciphertext),
    },
    templates,
    logs: (logResult.data || []).map((row) => ({
      id: row.id,
      eventKey: row.event_key,
      toEmail: row.to_email,
      subject: row.subject,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
    })),
  };
}

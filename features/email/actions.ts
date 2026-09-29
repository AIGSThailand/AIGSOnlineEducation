"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAppEnv } from "@/lib/env/resolve-app-env";
import { requireAdmin } from "@/features/courses/permissions";
import type { ActionResult } from "@/features/courses/types";
import { getPlatformSettings } from "@/features/settings/queries";
import { encryptSecret } from "./crypto";
import { isEmailEventKey } from "./events";
import { unknownTemplateVariables } from "./render";
import { resetTemplateSchema, saveSmtpSchema, saveTemplateSchema } from "./schema";
import { sendApplicationEmail } from "./service";

function revalidateEmail() {
  revalidatePath("/admin/settings/email");
}

export async function saveSmtpSettingsAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = saveSmtpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid SMTP settings." };
  }

  const appEnv = resolveAppEnv();
  const db = createAdminClient();
  const password = parsed.data.password?.trim() ?? "";

  let passwordCiphertext: string | null | undefined;
  if (password) {
    try {
      passwordCiphertext = encryptSecret(password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not encrypt the SMTP password.";
      return { success: false, error: message };
    }
  }

  const { data: existing } = await db
    .from("email_smtp_configs")
    .select("password_ciphertext")
    .eq("app_env", appEnv)
    .maybeSingle<{ password_ciphertext: string | null }>();

  const nextCiphertext =
    passwordCiphertext !== undefined ? passwordCiphertext : existing?.password_ciphertext ?? null;

  const { error } = await db.from("email_smtp_configs").upsert(
    {
      app_env: appEnv,
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      username: parsed.data.username?.trim() || null,
      password_ciphertext: nextCiphertext,
      from_email: parsed.data.fromEmail,
      from_name: parsed.data.fromName?.trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    } as never,
    { onConflict: "app_env" }
  );

  if (error) return { success: false, error: error.message };
  revalidateEmail();
  return { success: true };
}

export async function saveEmailTemplateAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = saveTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid template." };
  }

  if (!isEmailEventKey(parsed.data.eventKey)) {
    return { success: false, error: "Unknown email event." };
  }

  const content = {
    subject: parsed.data.subject,
    htmlBody: parsed.data.htmlBody,
    textBody: parsed.data.textBody,
  };
  const unknown = unknownTemplateVariables(parsed.data.eventKey, content);
  if (unknown.length) {
    return {
      success: false,
      error: `Unknown variables: ${unknown.map((key) => `{{${key}}}`).join(", ")}.`,
    };
  }

  const db = createAdminClient();
  const { error } = await db.from("email_templates").upsert(
    {
      app_env: resolveAppEnv(),
      event_key: parsed.data.eventKey,
      subject: parsed.data.subject,
      html_body: parsed.data.htmlBody,
      text_body: parsed.data.textBody,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    } as never,
    { onConflict: "app_env,event_key" }
  );

  if (error) return { success: false, error: error.message };
  revalidateEmail();
  return { success: true };
}

export async function resetEmailTemplateAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = resetTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid template." };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("email_templates")
    .delete()
    .eq("app_env", resolveAppEnv())
    .eq("event_key", parsed.data.eventKey);

  if (error) return { success: false, error: error.message };
  revalidateEmail();
  return { success: true };
}

/** Sends email.test to the signed-in admin only. Ignores any client-supplied address. */
export async function sendTestEmailAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.email) {
    return { success: false, error: "Your account has no email address." };
  }

  const settings = await getPlatformSettings();
  await sendApplicationEmail({
    eventKey: "email.test",
    to: admin.email,
    variables: {
      siteName: settings.site_name,
      appEnv: resolveAppEnv(),
      adminEmail: admin.email,
    },
  });

  revalidateEmail();
  return { success: true };
}

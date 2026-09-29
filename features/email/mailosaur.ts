import type { AppEnv } from "@/lib/env/types";

/** Mailosaur virtual SMTP. Port 2525 uses STARTTLS, so `secure` stays false. */
export const MAILOSAUR_SMTP_HOST = "smtp.mailosaur.net";
export const MAILOSAUR_SMTP_PORT = 2525;

export type MailosaurCaptureHint = {
  host: string;
  port: number;
  secure: false;
  username: string;
  inboxDomain: string;
};

function serverId(value: string | undefined): string | null {
  const id = value?.trim() ?? "";
  if (!/^[a-zA-Z0-9]{4,32}$/.test(id)) return null;
  return id;
}

/**
 * Public connection hint for local and staging admin SMTP.
 * Returns null in production so the admin page never suggests a test inbox there.
 * The API key and SMTP password are not part of this object.
 */
export function mailosaurCaptureHint(
  appEnv: AppEnv,
  rawServerId: string | undefined
): MailosaurCaptureHint | null {
  if (appEnv === "production") return null;
  const id = serverId(rawServerId);
  if (!id) return null;
  return {
    host: MAILOSAUR_SMTP_HOST,
    port: MAILOSAUR_SMTP_PORT,
    secure: false,
    username: `${id}@mailosaur.net`,
    inboxDomain: `${id}.mailosaur.net`,
  };
}

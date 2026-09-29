/**
 * Send the built-in SMTP test through Mailosaur, then fetch it and request two client previews.
 *
 * Local and staging only. Requires MAILOSAUR_API_KEY and MAILOSAUR_SERVER_ID.
 * Does not print the API key or the SMTP password.
 *
 *   npm run test:mailosaur-email
 *   npm run test:mailosaur-email -- --env staging
 */
import nodemailer from "nodemailer";
import MailosaurClient from "mailosaur";
import { EMAIL_EVENTS } from "../features/email/events";
import { mailosaurCaptureHint } from "../features/email/mailosaur";
import { renderEmailTemplate } from "../features/email/render";
import { loadCliEnv, parseEnvFlag } from "./lib/load-cli-env.mjs";

function previewClients(clients: { label?: string; name?: string }[]): string[] {
  const preferred = clients.filter((client) => {
    const label = `${client.label ?? ""} ${client.name ?? ""}`.toLowerCase();
    return label.includes("gmail") || label.includes("outlook");
  });
  const chosen = (preferred.length > 0 ? preferred : clients).slice(0, 2);
  return chosen.map((client) => client.label).filter((label): label is string => Boolean(label));
}

async function main(): Promise<void> {
  const envName = parseEnvFlag(process.argv);
  if (envName === "production") {
    throw new Error("Mailosaur capture is for local and staging only.");
  }
  loadCliEnv(envName);
  const appEnv = (process.env.APP_ENV || envName).trim().toLowerCase();
  if (appEnv === "production") {
    throw new Error("Mailosaur capture is for local and staging only.");
  }

  const apiKey = process.env.MAILOSAUR_API_KEY?.trim();
  const serverId = process.env.MAILOSAUR_SERVER_ID?.trim();
  const hint = mailosaurCaptureHint(appEnv === "staging" ? "staging" : "local", serverId);
  if (!apiKey || !hint || !serverId) {
    throw new Error(
      "Set MAILOSAUR_API_KEY and MAILOSAUR_SERVER_ID in the env file. Leave them unset for production."
    );
  }

  const client = new MailosaurClient(apiKey);
  const smtpPassword = await client.servers.getPassword(serverId);
  const to = client.servers.generateEmailAddress(serverId);
  const receivedAfter = new Date();
  const rendered = renderEmailTemplate(EMAIL_EVENTS["email.test"].defaults, {
    siteName: "AIGS",
    appEnv,
    adminEmail: to,
  });

  const transport = nodemailer.createTransport({
    host: hint.host,
    port: hint.port,
    secure: hint.secure,
    auth: { user: hint.username, pass: smtpPassword },
  });
  await transport.sendMail({
    from: "AIGS Online Education <noreply@example.com>",
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  const message = await client.messages.get(serverId, { sentTo: to }, { receivedAfter, timeout: 20000 });
  const summary: Record<string, unknown> = {
    messageId: message.id,
    subject: message.subject,
    sentTo: to,
    textMatched: Boolean(message.text?.body?.includes(appEnv)),
    sms: "This app does not send SMS, so no Mailosaur phone number is used.",
  };

  try {
    const clients = await client.previews.listEmailClients();
    const emailClients = previewClients(clients.items ?? []);
    if (!message.id || emailClients.length === 0) {
      summary.previews = "Captured. Open the message in Mailosaur and choose Generate Email Previews.";
    } else {
      const previews = await client.messages.generatePreviews(message.id, { emailClients });
      summary.previews = (previews.items ?? []).map((preview) => ({
        id: preview.id,
        emailClient: preview.emailClient,
      }));
    }
  } catch (err) {
    summary.previews =
      err instanceof Error
        ? `Captured. Preview generation was not available: ${err.message}`
        : "Captured. Open the message in Mailosaur and choose Generate Email Previews.";
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

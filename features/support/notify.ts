import { getPlatformSettings } from "@/features/settings/queries";

/**
 * Best-effort staff notification when a new support ticket is created.
 * Skips when support_email is unset. Uses Resend when RESEND_API_KEY is set.
 */
export async function notifyNewSupportTicket(params: {
  ticketId: string;
  subject: string;
  body: string;
  userEmail?: string | null;
}): Promise<void> {
  const settings = await getPlatformSettings();
  const to = settings.support_email;
  if (!to) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      "[support] New ticket stored; email skipped (no RESEND_API_KEY). Ticket:",
      params.ticketId,
      "→",
      to
    );
    return;
  }

  const fromName = settings.support_from_name || "AIGS Support";
  const from = process.env.SUPPORT_FROM_EMAIL || "onboarding@resend.dev";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: [to],
        subject: `[Support] ${params.subject}`,
        text: [
          `New support ticket: ${params.ticketId}`,
          params.userEmail ? `From: ${params.userEmail}` : null,
          "",
          params.body,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[support] Failed to send ticket email:", res.status, text);
    }
  } catch (err) {
    console.error("[support] Failed to send ticket email:", err);
  }
}

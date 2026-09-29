import { sendApplicationEmail } from "@/features/email/service";
import { getPlatformSettings } from "@/features/settings/queries";

/**
 * Best-effort staff notification when a new support ticket is created.
 * Failures are logged by EmailService and never block ticket creation.
 */
export async function notifyNewSupportTicket(params: {
  ticketId: string;
  subject: string;
  body: string;
  userEmail?: string | null;
}): Promise<void> {
  const settings = await getPlatformSettings();
  await sendApplicationEmail({
    eventKey: "support.ticket_created",
    to: settings.support_email || "",
    variables: {
      siteName: settings.site_name,
      ticketId: params.ticketId,
      subject: params.subject,
      body: params.body,
      userEmail: params.userEmail || "",
    },
  });
}

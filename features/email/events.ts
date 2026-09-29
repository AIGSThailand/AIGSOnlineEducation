export const EMAIL_EVENT_KEYS = ["support.ticket_created", "email.test"] as const;

export type EmailEventKey = (typeof EMAIL_EVENT_KEYS)[number];

export type EmailVariable = {
  key: string;
  description: string;
};

export type EmailTemplateContent = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

export type EmailEventDefinition = {
  key: EmailEventKey;
  label: string;
  description: string;
  variables: EmailVariable[];
  defaults: EmailTemplateContent;
};

const supportDefaults: EmailTemplateContent = {
  subject: "[{{siteName}}] New support ticket: {{subject}}",
  htmlBody: [
    "<p>A new support ticket was opened.</p>",
    "<p><strong>Ticket</strong><br>{{ticketId}}</p>",
    "<p><strong>From</strong><br>{{userEmail}}</p>",
    "<p><strong>Subject</strong><br>{{subject}}</p>",
    "<p><strong>Message</strong></p>",
    "<p>{{body}}</p>",
  ].join(""),
  textBody: [
    "A new support ticket was opened.",
    "",
    "Ticket: {{ticketId}}",
    "From: {{userEmail}}",
    "Subject: {{subject}}",
    "",
    "{{body}}",
  ].join("\n"),
};

const testDefaults: EmailTemplateContent = {
  subject: "[{{siteName}}] SMTP test ({{appEnv}})",
  htmlBody:
    "<p>This is a test message from {{siteName}}.</p><p>Environment: {{appEnv}}<br>Sent to: {{adminEmail}}</p>",
  textBody: "This is a test message from {{siteName}}.\nEnvironment: {{appEnv}}\nSent to: {{adminEmail}}",
};

export const EMAIL_EVENTS: Record<EmailEventKey, EmailEventDefinition> = {
  "support.ticket_created": {
    key: "support.ticket_created",
    label: "New support ticket",
    description: "Sent to the platform support address when a learner opens a ticket.",
    variables: [
      { key: "siteName", description: "Site name from platform settings" },
      { key: "ticketId", description: "Support ticket id" },
      { key: "subject", description: "Ticket subject" },
      { key: "body", description: "First message" },
      { key: "userEmail", description: "Learner email" },
    ],
    defaults: supportDefaults,
  },
  "email.test": {
    key: "email.test",
    label: "SMTP test",
    description: "Sent only to the signed-in admin from the test button.",
    variables: [
      { key: "siteName", description: "Site name from platform settings" },
      { key: "appEnv", description: "local, staging, or production" },
      { key: "adminEmail", description: "Signed-in admin email" },
    ],
    defaults: testDefaults,
  },
};

export function isEmailEventKey(value: string): value is EmailEventKey {
  return (EMAIL_EVENT_KEYS as readonly string[]).includes(value);
}

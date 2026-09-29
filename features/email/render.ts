import {
  EMAIL_EVENTS,
  type EmailEventKey,
  type EmailTemplateContent,
} from "./events";

const TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractTemplateVariables(source: string): string[] {
  const found = new Set<string>();
  for (const match of Array.from(source.matchAll(TOKEN))) {
    if (match[1]) found.add(match[1]);
  }
  return Array.from(found);
}

export function unknownTemplateVariables(
  eventKey: EmailEventKey,
  content: EmailTemplateContent
): string[] {
  const allowed = new Set(EMAIL_EVENTS[eventKey].variables.map((item) => item.key));
  const used = extractTemplateVariables(
    `${content.subject}\n${content.htmlBody}\n${content.textBody}`
  );
  return used.filter((key) => !allowed.has(key));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\0/g, "").slice(0, 200);
}

function sanitizeText(value: string): string {
  return value.replace(/\0/g, "");
}

function fill(template: string, variables: Record<string, string>, mode: "html" | "text" | "subject"): string {
  return template.replace(TOKEN, (_match, key: string) => {
    const raw = sanitizeText(variables[key] ?? "");
    if (mode === "html") return escapeHtml(raw);
    if (mode === "subject") return sanitizeHeader(raw);
    return raw;
  });
}

export function renderEmailTemplate(
  content: EmailTemplateContent,
  variables: Record<string, string>
): { subject: string; html: string; text: string } {
  return {
    subject: sanitizeHeader(fill(content.subject, variables, "subject")),
    html: fill(content.htmlBody, variables, "html"),
    text: fill(content.textBody, variables, "text"),
  };
}

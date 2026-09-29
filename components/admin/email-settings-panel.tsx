"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  saveSmtpSettingsAction,
  sendTestEmailAction,
} from "@/features/email/actions";
import type { MailosaurCaptureHint } from "@/features/email/mailosaur";
import type {
  EmailLogView,
  SmtpAdminView,
  TemplateAdminView,
} from "@/features/email/queries";

export function EmailSettingsPanel({
  smtp,
  templates,
  logs,
  loadError,
  mailosaur,
}: {
  smtp: SmtpAdminView;
  templates: TemplateAdminView[];
  logs: EmailLogView[];
  loadError: string | null;
  mailosaur: MailosaurCaptureHint | null;
}) {
  if (loadError) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Email tables are not available yet. Apply migration{" "}
        <span className="font-mono">20260928000000_email_system.sql</span>. {loadError}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <SmtpForm smtp={smtp} mailosaur={mailosaur} />
      <TemplateForm templates={templates} />
      <LogList logs={logs} />
    </div>
  );
}

function SmtpForm({
  smtp,
  mailosaur,
}: {
  smtp: SmtpAdminView;
  mailosaur: MailosaurCaptureHint | null;
}) {
  const router = useRouter();
  const [host, setHost] = useState(smtp.host);
  const [port, setPort] = useState(String(smtp.port));
  const [secure, setSecure] = useState(smtp.secure);
  const [username, setUsername] = useState(smtp.username);
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(smtp.fromEmail);
  const [fromName, setFromName] = useState(smtp.fromName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setTestNote(null);
    startTransition(async () => {
      const result = await saveSmtpSettingsAction({
        host,
        port: Number(port),
        secure,
        username,
        password,
        fromEmail,
        fromName,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPassword("");
      setSaved(true);
      router.refresh();
    });
  }

  function onTest() {
    setError(null);
    setTestNote(null);
    startTransition(async () => {
      const result = await sendTestEmailAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setTestNote("Test attempted. The log below shows sent, failed, or skipped.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">SMTP</h2>
        <p className="mt-1 text-xs text-slate-500">
          Saved for the <span className="font-medium">{smtp.appEnv}</span> environment only. The
          password stays on the server and is not shown again.
        </p>
        {mailosaur ? (
          <p className="mt-2 text-xs text-slate-500">
            Mailosaur capture for this environment: host {mailosaur.host}, port {mailosaur.port},
            secure off, username {mailosaur.username}. Any address at {mailosaur.inboxDomain} is
            captured. Generate client previews from that message in Mailosaur. The SMTP password
            comes from the inbox Connect tab.
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="smtp-host">Host</Label>
          <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="smtp-port">Port</Label>
          <Input
            id="smtp-port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="smtp-user">Username</Label>
          <Input id="smtp-user" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="smtp-pass">Password</Label>
          <Input
            id="smtp-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            placeholder={smtp.passwordConfigured ? "Saved — leave blank to keep" : "SMTP password"}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="smtp-from">From email</Label>
          <Input
            id="smtp-from"
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="smtp-from-name">From name</Label>
          <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
        Implicit TLS (typical for port 465). Leave off for port 587.
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">SMTP settings saved.</p> : null}
      {testNote ? <p className="text-sm text-slate-600">{testNote}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={isPending}>
          Save SMTP
        </Button>
        <Button type="button" variant="outline" disabled={isPending} onClick={onTest}>
          Send test to me
        </Button>
      </div>
    </form>
  );
}

function TemplateForm({ templates }: { templates: TemplateAdminView[] }) {
  const router = useRouter();
  const [eventKey, setEventKey] = useState(templates[0]?.eventKey ?? "support.ticket_created");
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      templates.map((item) => [
        item.eventKey,
        { subject: item.subject, htmlBody: item.htmlBody, textBody: item.textBody },
      ])
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        templates.map((item) => [
          item.eventKey,
          { subject: item.subject, htmlBody: item.htmlBody, textBody: item.textBody },
        ])
      )
    );
  }, [templates]);

  const current = useMemo(
    () => templates.find((item) => item.eventKey === eventKey) ?? templates[0],
    [templates, eventKey]
  );
  const draft = current ? drafts[current.eventKey] : undefined;

  if (!current || !draft) return null;

  const activeEvent = current.eventKey;
  const activeDraft = draft;

  function patch(partial: Partial<{ subject: string; htmlBody: string; textBody: string }>) {
    setDrafts((prev) => ({
      ...prev,
      [activeEvent]: { ...prev[activeEvent], ...partial },
    }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveEmailTemplateAction({
        eventKey: activeEvent,
        subject: activeDraft.subject,
        htmlBody: activeDraft.htmlBody,
        textBody: activeDraft.textBody,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onReset() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await resetEmailTemplateAction({ eventKey: activeEvent });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Templates</h2>
        <p className="mt-1 text-xs text-slate-500">
          Mail is sent by event key, not by template id. Only the listed variables are allowed.
          User-entered values are escaped in HTML.
        </p>
      </div>
      <div>
        <Label htmlFor="email-event">Event</Label>
        <select
          id="email-event"
          className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={current.eventKey}
          onChange={(e) => {
            setEventKey(e.target.value as TemplateAdminView["eventKey"]);
            setSaved(false);
            setError(null);
          }}
        >
          {templates.map((item) => (
            <option key={item.eventKey} value={item.eventKey}>
              {item.label} ({item.eventKey})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {current.description}{" "}
          {current.customized ? "Custom template." : "Using the built-in default."}
        </p>
      </div>
      <ul className="text-xs text-slate-600">
        {current.variables.map((item) => (
          <li key={item.key}>
            <code>{`{{${item.key}}}`}</code> — {item.description}
          </li>
        ))}
      </ul>
      <div>
        <Label htmlFor="email-subject">Subject</Label>
        <Input
          id="email-subject"
          value={draft.subject}
          onChange={(e) => patch({ subject: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="email-html">HTML</Label>
        <Textarea
          id="email-html"
          rows={8}
          value={draft.htmlBody}
          onChange={(e) => patch({ htmlBody: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="email-text">Plain text</Label>
        <Textarea
          id="email-text"
          rows={6}
          value={draft.textBody}
          onChange={(e) => patch({ textBody: e.target.value })}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Template updated.</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={isPending}>
          Save template
        </Button>
        <Button type="button" variant="outline" disabled={isPending || !current.customized} onClick={onReset}>
          Reset to default
        </Button>
      </div>
    </form>
  );
}

function LogList({ logs }: { logs: EmailLogView[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Recent sends</h2>
      {logs.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No messages yet for this environment.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {logs.map((log) => (
            <li key={log.id} className="py-2">
              <p className="font-medium text-slate-800">
                {log.status} · {log.eventKey}
              </p>
              <p className="text-slate-600">
                {log.toEmail} — {log.subject}
              </p>
              <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
              {log.error ? <p className="text-xs text-red-600">{log.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

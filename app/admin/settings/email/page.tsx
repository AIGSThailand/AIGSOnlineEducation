import Link from "next/link";
import { requireAdmin } from "@/features/courses/permissions";
import { mailosaurCaptureHint } from "@/features/email/mailosaur";
import { getEmailAdminView } from "@/features/email/queries";
import { EmailSettingsPanel } from "@/components/admin/email-settings-panel";
import { resolveAppEnv } from "@/lib/env/resolve-app-env";

export default async function AdminEmailSettingsPage() {
  await requireAdmin();
  const view = await getEmailAdminView();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/admin/settings" className="hover:text-slate-800">
            Platform settings
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Email</h1>
        <p className="text-sm text-slate-500">
          Transactional SMTP and templates for this environment. Sign-in, invite, and password
          reset mail stay on Supabase.
        </p>
      </div>
      <EmailSettingsPanel
        smtp={view.smtp}
        templates={view.templates}
        logs={view.logs}
        loadError={view.loadError}
        mailosaur={mailosaurCaptureHint(resolveAppEnv(), process.env.MAILOSAUR_SERVER_ID)}
      />
    </div>
  );
}

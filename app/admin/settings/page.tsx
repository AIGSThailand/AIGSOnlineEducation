import { requireAdmin } from "@/features/courses/permissions";
import { getPlatformSettings } from "@/features/settings/queries";
import { PlatformSettingsForm } from "@/components/settings/platform-settings-form";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getPlatformSettings();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Platform settings</h1>
        <p className="text-sm text-slate-500">
          Site identity, support contact, and maintenance controls
        </p>
      </div>
      <PlatformSettingsForm settings={settings} />
    </div>
  );
}

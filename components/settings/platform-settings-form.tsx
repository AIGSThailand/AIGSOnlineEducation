"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updatePlatformSettingsAction } from "@/features/settings/actions";
import type { PlatformSettingsMap } from "@/features/settings/types";

export function PlatformSettingsForm({ settings }: { settings: PlatformSettingsMap }) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(settings.site_name);
  const [supportEmail, setSupportEmail] = useState(settings.support_email || "");
  const [supportFromName, setSupportFromName] = useState(settings.support_from_name);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode);
  const [announcementBannerEnabled, setAnnouncementBannerEnabled] = useState(
    settings.announcement_banner_enabled
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        siteName,
        supportEmail,
        supportFromName,
        maintenanceMode,
        announcementBannerEnabled,
      });
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
        <Label htmlFor="site-name">Site name</Label>
        <Input
          id="site-name"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="support-email">Support email</Label>
        <Input
          id="support-email"
          type="email"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          placeholder="education@aigsthailand.com"
        />
        <p className="mt-1 text-xs text-slate-500">
          Used for new support-ticket notifications when configured.
        </p>
      </div>
      <div>
        <Label htmlFor="support-from">Support from name</Label>
        <Input
          id="support-from"
          value={supportFromName}
          onChange={(e) => setSupportFromName(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={maintenanceMode}
          onChange={(e) => setMaintenanceMode(e.target.checked)}
        />
        Maintenance mode
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={announcementBannerEnabled}
          onChange={(e) => setAnnouncementBannerEnabled(e.target.checked)}
        />
        Show announcement banners on dashboards
      </label>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Settings saved.</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

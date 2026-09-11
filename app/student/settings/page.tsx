import { requireAuth } from "@/lib/auth/permissions";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

export default async function StudentSettingsPage() {
  const user = await requireAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account settings</h1>
        <p className="text-sm text-slate-500">Update your profile and password preferences</p>
      </div>
      <AccountSettingsForm
        firstName={user.profile?.first_name || ""}
        lastName={user.profile?.last_name || ""}
        email={user.email}
      />
    </div>
  );
}

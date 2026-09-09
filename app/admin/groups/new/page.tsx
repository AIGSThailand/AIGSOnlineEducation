import Link from "next/link";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import { GroupDetailsForm } from "@/components/groups/group-details-form";

export default async function AdminNewGroupPage() {
  await requireCourseBuilderAccess("admin");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/groups" className="text-sm text-slate-500 hover:text-brand-700">
          ← All groups
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          New group / bundle
        </h1>
        <p className="text-sm text-slate-500">
          Create the container first, then attach courses, members, and Stripe price.
        </p>
      </div>
      <GroupDetailsForm mode={{ kind: "create" }} />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCourseBuilderAccess } from "@/features/courses/permissions";
import {
  getGroupDetail,
  listPublishedCoursesForGroupPicker,
} from "@/features/groups/queries";
import { GroupDetailsForm } from "@/components/groups/group-details-form";
import { GroupCoursesEditor } from "@/components/groups/group-courses-editor";
import { GroupMembersEditor } from "@/components/groups/group-members-editor";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: { groupId: string };
}

export default async function AdminEditGroupPage({ params }: PageProps) {
  await requireCourseBuilderAccess("admin");
  const [group, allCourses] = await Promise.all([
    getGroupDetail(params.groupId),
    listPublishedCoursesForGroupPicker(),
  ]);

  if (!group) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/groups" className="text-sm text-slate-500 hover:text-brand-700">
            ← All groups
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{group.name}</h1>
          <p className="text-sm text-slate-500">
            Manage courses, members, and Stripe bundle pricing
          </p>
        </div>
        {group.status === "active" ? (
          <Link href={`/bundles/${group.id}`} target="_blank">
            <Button variant="outline">View public bundle</Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GroupDetailsForm mode={{ kind: "edit", group }} />
        <GroupCoursesEditor
          groupId={group.id}
          selected={group.courses}
          allCourses={allCourses}
        />
      </div>

      <GroupMembersEditor groupId={group.id} members={group.members} />
    </div>
  );
}

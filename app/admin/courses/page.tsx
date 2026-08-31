import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  const courses = (data as CourseRow[] | null) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Course Administration
          </h1>
          <p className="text-sm text-slate-500">
            Create, publish, and manage all courses across the platform
          </p>
        </div>
        <Link href="/courses">
          <Button variant="outline">Browse Public Catalog</Button>
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100">
          <CardTitle>All Platform Courses ({courses.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Title & Slug</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">WP Course ID</th>
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.length > 0 ? (
                  courses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{c.title}</div>
                        <div className="text-xs text-slate-500 font-mono">/{c.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={c.status === "published" ? "success" : "default"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {c.wordpress_course_id ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/courses/${c.id}`}>
                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No courses found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getPublicGroupBundle } from "@/features/groups/queries";
import { fulfillCheckoutSessionForUser } from "@/lib/stripe/enroll-from-checkout";
import { BuyBundleButton } from "@/components/stripe/buy-bundle-button";
import { RichContent } from "@/components/courses/rich-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PageProps {
  params: { groupId: string };
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function PublicBundlePage({ params, searchParams }: PageProps) {
  const group = await getPublicGroupBundle(params.groupId);
  if (!group) notFound();

  const user = await getCurrentUser();
  let checkoutMessage: { tone: "success" | "error"; text: string } | null = null;

  if (user && searchParams?.session_id) {
    const fulfilled = await fulfillCheckoutSessionForUser(searchParams.session_id, user.id);
    if (fulfilled.ok) {
      checkoutMessage = {
        tone: "success",
        text:
          fulfilled.kind === "group"
            ? `Payment confirmed — you are enrolled in ${fulfilled.enrolled} course(s) in this bundle.`
            : "Payment confirmed — enrollment updated.",
      };
    } else if (searchParams.checkout === "success") {
      checkoutMessage = {
        tone: "error",
        text: `Payment received, but bundle enrollment could not be confirmed yet (${fulfilled.error}).`,
      };
    }
  }

  let isMember = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("group_users")
      .select("user_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle<{ user_id: string }>();
    isMember = !!data;
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-8 text-sm">
        <Link href="/courses" className="text-slate-500 hover:text-brand-700">
          ← Courses
        </Link>
      </nav>

      {checkoutMessage ? (
        <div
          className={
            checkoutMessage.tone === "success"
              ? "mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              : "mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          }
          role="status"
        >
          {checkoutMessage.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <Badge variant="success">Bundle</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {group.name}
            </h1>
            <RichContent
              html={group.description}
              className="mt-4 text-base"
              fallback="Purchase once to unlock every course in this bundle."
            />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Included courses</h2>
            <ul className="mt-3 space-y-2">
              {group.courses.length === 0 ? (
                <li className="text-sm text-slate-500">Courses will appear here soon.</li>
              ) : (
                group.courses.map((course) => (
                  <li key={course.id}>
                    <Link
                      href={`/courses/${course.id}`}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-brand-300"
                    >
                      <span>{course.title}</span>
                      <span className="text-xs text-brand-600">View →</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <Card className="h-fit p-6">
          {isMember ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-emerald-800">You have access to this bundle.</p>
              <Link href="/student/courses" className="block">
                <Button className="w-full">Go to my courses</Button>
              </Link>
            </div>
          ) : user ? (
            group.stripePriceId ? (
              <BuyBundleButton groupId={group.id} priceId={group.stripePriceId} label="Buy bundle" />
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This bundle is not open for purchase yet.
              </p>
            )
          ) : (
            <Link href={`/login?redirect=/bundles/${group.id}`} className="block">
              <Button className="w-full" size="lg">
                Sign in to buy
              </Button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}

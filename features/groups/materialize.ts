import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ensure a student has active enrollments for every course in a group.
 * Does not overwrite stronger sources (stripe / migration / admin) except
 * when source is explicitly stripe from a checkout session.
 */
export async function materializeGroupCourseEnrollments(options: {
  userId: string;
  groupId: string;
  courseIds: string[];
  enrollmentSource: "group" | "stripe";
  sourceReference: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<{ enrolled: number; skipped: number; errors: string[] }> {
  const admin = createAdminClient();
  let enrolled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const courseId of options.courseIds) {
    const { data: existing } = await admin
      .from("enrollments")
      .select("id, enrollment_source")
      .eq("student_id", options.userId)
      .eq("course_id", courseId)
      .maybeSingle<{ id: string; enrollment_source: string }>();

    if (existing) {
      const src = existing.enrollment_source;
      if (
        options.enrollmentSource === "group" &&
        (src === "stripe" || src === "migration" || src === "admin" || src === "group")
      ) {
        skipped += 1;
        continue;
      }
    }

    const { data: courseAccess } = await admin
      .from("courses")
      .select("access_expiration_enabled, access_period_days")
      .eq("id", courseId)
      .maybeSingle<{
        access_expiration_enabled: boolean;
        access_period_days: number | null;
      }>();

    const enrolledAt = new Date();
    let expiresAt: string | null = null;
    if (
      courseAccess?.access_expiration_enabled &&
      courseAccess.access_period_days &&
      courseAccess.access_period_days > 0
    ) {
      const end = new Date(enrolledAt.getTime());
      end.setUTCDate(end.getUTCDate() + courseAccess.access_period_days);
      expiresAt = end.toISOString();
    }

    const { error } = await admin.from("enrollments").upsert(
      {
        student_id: options.userId,
        course_id: courseId,
        status: "active",
        enrollment_source: options.enrollmentSource,
        source_reference: options.sourceReference,
        enrolled_at: enrolledAt.toISOString(),
        expires_at: expiresAt,
        stripe_checkout_session_id: options.stripeCheckoutSessionId ?? null,
        stripe_payment_intent_id: options.stripePaymentIntentId ?? null,
        stripe_subscription_id: options.stripeSubscriptionId ?? null,
      } as never,
      { onConflict: "student_id,course_id" }
    );

    if (error) {
      errors.push(`${courseId}: ${error.message}`);
    } else {
      enrolled += 1;
    }
  }

  return { enrolled, skipped, errors };
}

export async function ensureGroupMembership(userId: string, groupId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("group_users").upsert(
    {
      group_id: groupId,
      user_id: userId,
    } as never,
    { onConflict: "group_id,user_id" }
  );
  if (error) throw new Error(error.message);
}

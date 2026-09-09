import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import {
  ensureGroupMembership,
  materializeGroupCourseEnrollments,
} from "@/features/groups/materialize";
import { getGroupCourseIdsAdmin } from "@/features/groups/queries";
import type Stripe from "stripe";

export type EnrollFromCheckoutResult =
  | { ok: true; kind: "course"; courseId: string; userId: string; created: boolean }
  | {
      ok: true;
      kind: "group";
      groupId: string;
      userId: string;
      courseIds: string[];
      enrolled: number;
    }
  | { ok: false; error: string; courseId?: string; groupId?: string; userId?: string };

function paymentIntentIdOf(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

function subscriptionIdOf(session: Stripe.Checkout.Session): string | null {
  return typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id || null;
}

/**
 * Resolve Supabase user + course/group from a Checkout Session (metadata first).
 */
export async function resolveCheckoutEnrollmentTargets(
  session: Stripe.Checkout.Session
): Promise<{ userId: string | null; courseId: string | null; groupId: string | null }> {
  let userId =
    session.metadata?.supabase_user_id?.trim() ||
    session.client_reference_id?.trim() ||
    null;
  const courseId = session.metadata?.course_id?.trim() || null;
  const groupId = session.metadata?.group_id?.trim() || null;

  if (!userId && session.customer) {
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer.id;
    try {
      const customer = await getStripe().customers.retrieve(customerId);
      if (!customer.deleted) {
        userId = customer.metadata?.supabase_user_id?.trim() || null;
      }
    } catch (err) {
      console.error("[Stripe] Failed to load customer for enrollment targets:", err);
    }
  }

  return { userId, courseId, groupId };
}

/**
 * Upsert an active Stripe enrollment from a completed Checkout Session.
 * Idempotent on (student_id, course_id).
 */
export async function enrollStudentFromCheckoutSession(
  session: Stripe.Checkout.Session,
  options?: { userId?: string; courseId?: string }
): Promise<EnrollFromCheckoutResult> {
  const resolved = await resolveCheckoutEnrollmentTargets(session);
  const userId = options?.userId || resolved.userId;
  const courseId = options?.courseId || resolved.courseId;

  if (!userId || !courseId) {
    return {
      ok: false,
      error: `Missing enrollment targets (userId=${userId ?? "null"}, courseId=${courseId ?? "null"}).`,
      userId: userId ?? undefined,
      courseId: courseId ?? undefined,
    };
  }

  const adminClient = createAdminClient();
  const { data: courseAccess } = await adminClient
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

  const { data: existing } = await adminClient
    .from("enrollments")
    .select("id")
    .eq("student_id", userId)
    .eq("course_id", courseId)
    .maybeSingle<{ id: string }>();

  const { error: enrollError } = await adminClient.from("enrollments").upsert(
    {
      student_id: userId,
      course_id: courseId,
      status: "active",
      enrollment_source: "stripe",
      source_reference: session.id,
      enrolled_at: enrolledAt.toISOString(),
      expires_at: expiresAt,
      stripe_subscription_id: subscriptionIdOf(session),
      stripe_payment_intent_id: paymentIntentIdOf(session),
      stripe_checkout_session_id: session.id,
    } as never,
    {
      onConflict: "student_id,course_id",
    }
  );

  if (enrollError) {
    return {
      ok: false,
      error: enrollError.message,
      userId,
      courseId,
    };
  }

  return { ok: true, kind: "course", courseId, userId, created: !existing };
}

/**
 * Bundle purchase: add group membership + enroll into every attached course.
 */
export async function enrollStudentFromGroupCheckoutSession(
  session: Stripe.Checkout.Session,
  options?: { userId?: string; groupId?: string }
): Promise<EnrollFromCheckoutResult> {
  const resolved = await resolveCheckoutEnrollmentTargets(session);
  const userId = options?.userId || resolved.userId;
  const groupId = options?.groupId || resolved.groupId;

  if (!userId || !groupId) {
    return {
      ok: false,
      error: `Missing bundle targets (userId=${userId ?? "null"}, groupId=${groupId ?? "null"}).`,
      userId: userId ?? undefined,
      groupId: groupId ?? undefined,
    };
  }

  const courseIds = await getGroupCourseIdsAdmin(groupId);
  if (courseIds.length === 0) {
    return {
      ok: false,
      error: "This bundle has no courses attached.",
      userId,
      groupId,
    };
  }

  await ensureGroupMembership(userId, groupId);
  const result = await materializeGroupCourseEnrollments({
    userId,
    groupId,
    courseIds,
    enrollmentSource: "stripe",
    sourceReference: session.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentIdOf(session),
    stripeSubscriptionId: subscriptionIdOf(session),
  });

  if (result.errors.length > 0 && result.enrolled === 0) {
    return {
      ok: false,
      error: result.errors.join("; "),
      userId,
      groupId,
    };
  }

  return {
    ok: true,
    kind: "group",
    groupId,
    userId,
    courseIds,
    enrolled: result.enrolled,
  };
}

/**
 * Server-side fulfillment after Checkout redirect.
 * Verifies the session with Stripe (never trusts the browser alone).
 */
export async function fulfillCheckoutSessionForUser(
  sessionId: string,
  expectedUserId: string
): Promise<EnrollFromCheckoutResult> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);

  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required" ||
    session.status === "complete";

  if (!paid) {
    return {
      ok: false,
      error: `Checkout session is not paid (payment_status=${session.payment_status}, status=${session.status}).`,
    };
  }

  const { userId, courseId, groupId } = await resolveCheckoutEnrollmentTargets(session);
  if (!userId || userId !== expectedUserId) {
    return {
      ok: false,
      error: "Checkout session does not belong to the signed-in user.",
      userId: userId ?? undefined,
      courseId: courseId ?? undefined,
      groupId: groupId ?? undefined,
    };
  }

  if (groupId) {
    return enrollStudentFromGroupCheckoutSession(session, { userId, groupId });
  }

  return enrollStudentFromCheckoutSession(session, { userId, courseId: courseId ?? undefined });
}

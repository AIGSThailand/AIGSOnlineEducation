import { syncStripeSubscriptionToDatabase } from "./sync";
import { stripe } from "./server";
import {
  enrollStudentFromCheckoutSession,
  enrollStudentFromGroupCheckoutSession,
  resolveCheckoutEnrollmentTargets,
} from "./enroll-from-checkout";
import type Stripe from "stripe";

/**
 * Handles checkout.session.completed
 * Links purchased course/subscription and auto-enrolls student if applicable.
 */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const { userId, courseId, groupId } = await resolveCheckoutEnrollmentTargets(session);

  console.log(
    `[Stripe Webhook] checkout.session.completed session=${session.id} user=${userId ?? "null"} course=${courseId ?? "null"} group=${groupId ?? "null"} mode=${session.mode}`
  );

  // If subscription mode, sync the full subscription
  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionToDatabase(subscription, userId || undefined);
  }

  if (groupId) {
    const result = await enrollStudentFromGroupCheckoutSession(session, {
      userId: userId ?? undefined,
      groupId,
    });
    if (!result.ok) {
      console.error(`[Stripe Webhook] Bundle enrollment failed for ${session.id}: ${result.error}`);
    } else if (result.kind === "group") {
      console.log(
        `[Stripe Webhook] Student ${result.userId} enrolled into bundle ${result.groupId} (${result.enrolled}/${result.courseIds.length} courses)`
      );
    }
    return;
  }

  if (!courseId) {
    console.warn(
      `[Stripe Webhook] Skipping enrollment — session ${session.id} has no metadata.course_id or group_id`
    );
    return;
  }

  const result = await enrollStudentFromCheckoutSession(session, {
    userId: userId ?? undefined,
    courseId,
  });

  if (!result.ok) {
    console.error(`[Stripe Webhook] Enrollment failed for ${session.id}: ${result.error}`);
  } else if (result.kind === "course") {
    console.log(
      `[Stripe Webhook] Student ${result.userId} enrolled into course ${result.courseId} (created=${result.created})`
    );
  }
}

/**
 * Handles customer.subscription.created
 */
export async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Processing customer.subscription.created: ${subscription.id}`);
  await syncStripeSubscriptionToDatabase(subscription);
}

/**
 * Handles customer.subscription.updated
 */
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Processing customer.subscription.updated: ${subscription.id}`);
  await syncStripeSubscriptionToDatabase(subscription);
}

/**
 * Handles customer.subscription.deleted
 */
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[Stripe Webhook] Processing customer.subscription.deleted: ${subscription.id}`);
  await syncStripeSubscriptionToDatabase(subscription);
}

/**
 * Handles invoice.paid
 */
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log(`[Stripe Webhook] Processing invoice.paid for invoice: ${invoice.id}`);
  if (invoice.subscription) {
    const subId =
      typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subId);
    await syncStripeSubscriptionToDatabase(subscription);
  }
}

/**
 * Handles invoice.payment_failed
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.warn(`[Stripe Webhook] Payment failed for invoice: ${invoice.id}`);
  if (invoice.subscription) {
    const subId =
      typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subId);
    await syncStripeSubscriptionToDatabase(subscription);
  }
}

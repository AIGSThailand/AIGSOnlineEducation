import { createAdminClient } from "@/lib/supabase/admin";
import { syncStripeSubscriptionToDatabase } from "./sync";
import { stripe } from "./server";
import type Stripe from "stripe";

/**
 * Handles checkout.session.completed
 * Links purchased course/subscription and auto-enrolls student if applicable.
 */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const adminClient = createAdminClient();
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const userId = session.metadata?.supabase_user_id || session.client_reference_id;
  const courseId = session.metadata?.course_id;

  console.log(`[Stripe Webhook] Processing checkout.session.completed for user: ${userId}`);

  // If subscription mode, sync the full subscription
  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionToDatabase(subscription, userId || undefined);
  }

  // If direct course purchase or enrollment attached
  if (userId && courseId) {
    const { error: enrollError } = await (adminClient.from("enrollments") as any).upsert(
      {
        student_id: userId,
        course_id: courseId,
        status: "active",
        enrolled_at: new Date().toISOString(),
        stripe_subscription_id:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null,
      },
      {
        onConflict: "student_id,course_id",
      }
    );

    if (enrollError) {
      console.error(`[Stripe Webhook] Enrollment error: ${enrollError.message}`);
    } else {
      console.log(`[Stripe Webhook] Student ${userId} enrolled into course ${courseId}`);
    }
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
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;
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
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subId);
    await syncStripeSubscriptionToDatabase(subscription);
  }
}

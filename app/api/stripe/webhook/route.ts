import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { getStripeWebhookSecret } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhook-handlers";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * Claim a Stripe event for processing. Returns false if already claimed (duplicate delivery).
 */
async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("processed_stripe_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
    } as never)
    .select("event_id")
    .maybeSingle<{ event_id: string }>();

  if (error) {
    // Unique violation → already processed / in flight
    if (error.code === "23505") return false;
    throw error;
  }

  return Boolean(data?.event_id);
}

async function releaseStripeEventClaim(eventId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("processed_stripe_events").delete().eq("event_id", eventId);
}

/**
 * Stripe Webhook Route Handler
 * Verifies webhook signatures using the raw request body and dispatches events.
 * Idempotent via processed_stripe_events (claim-before-handle; release on failure).
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headerList = headers();
  const signature = headerList.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    console.error("[Stripe Webhook] Missing signature or STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json(
      { error: "Missing stripe-signature or webhook secret configuration." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
    console.error(`[Stripe Webhook Signature Verification Failed]: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${errorMessage}` },
      { status: 400 }
    );
  }

  let claimed = false;
  try {
    claimed = await claimStripeEvent(event);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type received: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    if (claimed) {
      try {
        await releaseStripeEventClaim(event.id);
      } catch (releaseErr) {
        console.error("[Stripe Webhook] Failed to release event claim:", releaseErr);
      }
    }
    const errorMessage = err instanceof Error ? err.message : "Webhook handler processing error";
    console.error(`[Stripe Webhook Handler Error]: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook handler failed: ${errorMessage}` }, { status: 500 });
  }
}

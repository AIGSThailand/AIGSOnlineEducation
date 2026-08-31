import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
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
 * Stripe Webhook Route Handler
 * Verifies webhook signatures using the raw request body and dispatches events.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const headerList = headers();
  const signature = headerList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("[Stripe Webhook] Missing signature or STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json(
      { error: "Missing stripe-signature or webhook secret configuration." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown verification error";
    console.error(`[Stripe Webhook Signature Verification Failed]: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${errorMessage}` },
      { status: 400 }
    );
  }

  try {
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
        // Unhandled event type logged safely
        console.log(`[Stripe Webhook] Unhandled event type received: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Webhook handler processing error";
    console.error(`[Stripe Webhook Handler Error]: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook handler failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}

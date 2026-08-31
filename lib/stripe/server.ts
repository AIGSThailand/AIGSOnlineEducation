import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production.");
}

/**
 * Server-only Stripe client instance.
 * CRITICAL: NEVER export or import this into Client Components.
 */
export const stripe = new Stripe(stripeSecretKey || "", {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  appInfo: {
    name: "AIGS Online Education LMS",
    version: "0.1.0",
  },
});

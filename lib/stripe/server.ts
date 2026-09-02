import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/env/server";

let stripeInstance: Stripe | null = null;

/**
 * Server-only Stripe client (lazy init with environment validation).
 * CRITICAL: NEVER export or import this into Client Components.
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(getStripeSecretKey(), {
      apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
      appInfo: {
        name: "AIGS Online Education LMS",
        version: "0.1.0",
      },
    });
  }
  return stripeInstance;
}

/**
 * Lazy Stripe client for existing imports. Prefer getStripe() in new code.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(getStripe());
    }
    return Reflect.get(client, prop, receiver);
  },
});

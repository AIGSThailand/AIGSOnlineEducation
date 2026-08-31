import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

/**
 * Initializes and caches the browser Stripe instance.
 * Uses the public key only.
 */
export function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined.");
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

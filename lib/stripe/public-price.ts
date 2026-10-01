import { cache } from "react";
import { getStripe } from "@/lib/stripe/server";

/** Resolve only public price information; credentials and Stripe objects stay on the server. */
export const getPublicPrice = cache(async (priceId?: string | null): Promise<string | null> => {
  if (!priceId) return null;
  try {
    const price = await getStripe().prices.retrieve(priceId, {}, { timeout: 5000, maxNetworkRetries: 0 });
    // The current course checkout supports fixed, one-time purchases only.
    if (!price.active || price.type !== "one_time" || price.billing_scheme !== "per_unit" || price.unit_amount === null) return null;
    const currency = price.currency.toUpperCase();
    const zeroDecimal = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "VND", "VUV", "XAF", "XOF", "XPF"]);
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" }).format(price.unit_amount / (zeroDecimal.has(currency) ? 1 : 100));
  } catch {
    return null;
  }
});

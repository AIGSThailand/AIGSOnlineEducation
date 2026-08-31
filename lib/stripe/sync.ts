import { stripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/types/database.types";
import type { CustomerMappingResult } from "@/types/stripe.types";
import type Stripe from "stripe";

/**
 * Maps a Supabase user to an existing or newly created Stripe Customer.
 * Ensures existing WordPress/LearnDash Stripe customers can be linked by email.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<CustomerMappingResult> {
  const adminClient = createAdminClient();

  // 1. Check if user already has an active subscription record with customer ID
  const { data: existingSub } = await adminClient
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existingSub?.stripe_customer_id) {
    return {
      customerId: existingSub.stripe_customer_id,
      isNew: false,
    };
  }

  // 2. Search Stripe for existing customer with the same email (from WordPress/LearnDash legacy)
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    // Attach Supabase user ID metadata if not present
    if (customer.metadata?.supabase_user_id !== userId) {
      await stripe.customers.update(customer.id, {
        metadata: {
          ...customer.metadata,
          supabase_user_id: userId,
        },
      });
    }

    return {
      customerId: customer.id,
      isNew: false,
    };
  }

  // 3. Create a new Stripe customer
  const newCustomer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: {
      supabase_user_id: userId,
    },
  });

  return {
    customerId: newCustomer.id,
    isNew: true,
  };
}

/**
 * Maps a Stripe Subscription object to a Supabase subscription record and persists it.
 */
export async function syncStripeSubscriptionToDatabase(
  subscription: Stripe.Subscription,
  overrideUserId?: string
) {
  const adminClient = createAdminClient();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  let userId = overrideUserId;

  if (!userId) {
    // 1. Try reading from subscription metadata
    userId = subscription.metadata?.supabase_user_id;
  }

  if (!userId) {
    // 2. Try fetching customer metadata
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      userId = customer.metadata?.supabase_user_id;

      // 3. Fallback: match profile by customer email
      if (!userId && customer.email) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .maybeSingle();

        if (profile) {
          userId = profile.id;
        }
      }
    }
  }

  if (!userId) {
    console.warn(
      `[Stripe Sync] Could not find Supabase user ID for customer ${customerId} / subscription ${subscription.id}`
    );
    return null;
  }

  const priceId = subscription.items.data[0]?.price.id || null;
  const status = mapStripeStatusToSupabase(subscription.status);
  const currentPeriodEnd = new Date(
    subscription.current_period_end * 1000
  ).toISOString();

  const { data, error } = await adminClient.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "stripe_subscription_id",
    }
  );

  if (error) {
    console.error(`[Stripe Sync Error] Failed to upsert subscription: ${error.message}`);
    throw error;
  }

  return data;
}

/**
 * Checks whether a given subscription status entitles a student to course access.
 */
export function isSubscriptionActiveForAccess(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Normalizes Stripe subscription status strings to Supabase enum values.
 */
export function mapStripeStatusToSupabase(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "paused":
      return "paused";
    default:
      return "canceled";
  }
}
